import express = require('express');
import * as request from 'supertest';
import { getConnection } from 'typeorm';
import {
	REST_PATH_SEGMENT,
	ROUTES_REQUIRING_AUTHORIZATION,
	ROUTES_REQUIRING_AUTHENTICATION,
} from './shared/constants';

import * as utils from './shared/utils';

let app: express.Application;

beforeAll(async () => {
	app = utils.initTestServer({ applyAuth: true, endpointGroups: ['me', 'auth', 'owner', 'users'] });
	await utils.initTestDb();
	utils.initLogger();
});

afterAll(() => {
	return getConnection().close();
});

ROUTES_REQUIRING_AUTHENTICATION.concat(ROUTES_REQUIRING_AUTHORIZATION).forEach((route) => {
	const [method, endpoint] = getMethodAndEndpoint(route);

	test(`${route} should return 401 Unauthorized if no cookie`, async () => {
		const response = await request(app)[method](endpoint).use(utils.prefix(REST_PATH_SEGMENT));

		expect(response.statusCode).toBe(401);
	});
});

ROUTES_REQUIRING_AUTHORIZATION.forEach(async (route) => {
	const [method, endpoint] = getMethodAndEndpoint(route);

	test(`${route} should return 403 Forbidden for member`, async () => {
		const member = await utils.createUser();
		const authMemberAgent = utils.createAgent(app, { auth: true, user: member });
		const response = await authMemberAgent[method](endpoint);
		if (response.statusCode === 500) {
			console.log(response);
		}

		expect(response.statusCode).toBe(403);
	});
});

function getMethodAndEndpoint(route: string) {
	return route.split(' ').map((segment, index) => {
		return index % 2 === 0 ? segment.toLowerCase() : segment;
	});
}
