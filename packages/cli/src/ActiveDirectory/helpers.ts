/* eslint-disable import/no-cycle */
import { Entry } from 'ldapts';
import { Db, IFeatureConfigDb } from '..';
import config from '../../config';
import { Settings } from '../databases/entities/Settings';
import { User } from '../databases/entities/User';
import { isUserManagementEnabled } from '../UserManagement/UserManagementHelper';
import { ActiveDirectoryManager } from './ActiveDirectoryManager';
import { ACTIVE_DIRECTORY_DISABLED, ACTIVE_DIRECTORY_FEATURE_NAME, SignInType } from './constants';
import type { ActiveDirectoryConfig } from './types';

const isActiveDirectoryDisabled = (): boolean => config.getEnv(ACTIVE_DIRECTORY_DISABLED);

export const isActiveDirectoryEnabled = (): boolean => !config.getEnv(ACTIVE_DIRECTORY_DISABLED);

const isFirstRunAfterFeatureEnabled = (databaseSettings: Settings[]) => {
	const dbSetting = databaseSettings.find((setting) => setting.key === ACTIVE_DIRECTORY_DISABLED);

	return !dbSetting;
};

const randonPassword = () => {
	return Math.random().toString(36).slice(-8);
};

const saveSettings = async () => {
	const setting: Settings = {
		key: ACTIVE_DIRECTORY_DISABLED,
		value: 'false',
		loadOnStartup: true,
	};

	await Db.collections.Settings.save(setting);

	config.set(ACTIVE_DIRECTORY_DISABLED, false);
};

const saveFeatureConfiguration = async () => {
	const featureConfig: IFeatureConfigDb = {
		name: 'activeDirectory',
		data: {
			activeDirectoryLoginEnabled: false,
			connection: {
				url: config.getEnv('activeDirectory.connection.url'),
			},
			binding: {
				baseDn: config.getEnv('activeDirectory.binding.baseDn'),
				adminDn: config.getEnv('activeDirectory.binding.adminDn'),
				adminPassword: config.getEnv('activeDirectory.binding.adminPassword'),
			},
			attributeMapping: {
				firstName: config.getEnv('activeDirectory.attributeMapping.firstName'),
				lastName: config.getEnv('activeDirectory.attributeMapping.lastName'),
				email: config.getEnv('activeDirectory.attributeMapping.email'),
				loginId: config.getEnv('activeDirectory.attributeMapping.loginId'),
				username: config.getEnv('activeDirectory.attributeMapping.username'),
			},
		},
	};
	await Db.collections.FeatureConfig.save<IFeatureConfigDb>(featureConfig);
};

export const getActiveDirectoryConfig = async (): Promise<{
	name: string;
	data: ActiveDirectoryConfig;
}> => {
	const configuration = await Db.collections.FeatureConfig.findOneOrFail({
		name: ACTIVE_DIRECTORY_FEATURE_NAME,
	});
	return {
		name: configuration.name,
		data: configuration.data as ActiveDirectoryConfig,
	};
};

// rename to handle ad first init
export const handleActiveDirectoryFirstInit = async (
	databaseSettings: Settings[],
): Promise<void> => {
	if (!isUserManagementEnabled()) return;

	if (isFirstRunAfterFeatureEnabled(databaseSettings)) {
		await saveSettings();

		await saveFeatureConfiguration();
	}

	const adConfig = await getActiveDirectoryConfig();

	ActiveDirectoryManager.init(adConfig.data);
};

const findUserOnActiveDirectory = async (
	email: string,
	password: string,
	loginIdAttribute: string,
): Promise<Entry | undefined> => {
	const activeDirectoryService = ActiveDirectoryManager.getInstance();

	const searchResult = await activeDirectoryService.searchWithAdminBinding(
		`(${loginIdAttribute}=${email})`,
	);

	if (!searchResult.length) {
		return undefined;
	}

	// get the last user in the results
	let user = searchResult.pop();

	if (user === undefined) {
		user = { dn: '' };
	}

	try {
		await activeDirectoryService.validUser(user.dn, password);
	} catch (error) {
		return undefined;
	}

	return user;
};

const getUserByUsername = async (usernameAttributeValue: string) => {
	return Db.collections.User.findOne(
		{
			username: usernameAttributeValue,
			signInType: SignInType.LDAP,
		},
		{
			relations: ['globalRole'],
		},
	);
};

const mapAttributesToLocalDb = (
	user: Entry,
	attributes: ActiveDirectoryConfig['attributeMapping'],
): Partial<User> => {
	return {
		email: user[attributes.email] as string,
		firstName: user[attributes.firstName] as string,
		lastName: user[attributes.lastName] as string,
		username: user[attributes.username] as string,
	};
};

export const handleActiveDirectoryLogin = async (
	email: string,
	password: string,
): Promise<User | undefined> => {
	if (isActiveDirectoryDisabled()) return undefined;

	const adConfig = await getActiveDirectoryConfig();

	if (!adConfig.data.activeDirectoryLoginEnabled) return undefined;

	const {
		data: { attributeMapping },
	} = adConfig;

	const adUser = await findUserOnActiveDirectory(email, password, attributeMapping.loginId);

	if (!adUser) return undefined;

	const usernameAttributeValue = adUser[attributeMapping.username] as string | undefined;

	if (!usernameAttributeValue) return undefined;

	const localUser = await getUserByUsername(usernameAttributeValue);

	if (!localUser) {
		// move this to it's own function
		const role = await Db.collections.Role.findOne({ scope: 'global', name: 'member' });

		await Db.collections.User.save({
			password: randonPassword(),
			signInType: SignInType.LDAP,
			globalRole: role,
			...mapAttributesToLocalDb(adUser, attributeMapping),
		});
	} else {
		// @ts-ignore
		delete localUser.isPending;
		// move this to it's own function
		await Db.collections.User.update(localUser.id, {
			...localUser,
			...mapAttributesToLocalDb(adUser, attributeMapping),
		});
	}

	// Retrieve the user again as user's data might have been updated
	const updatedUser = await getUserByUsername(usernameAttributeValue);

	return updatedUser;
};