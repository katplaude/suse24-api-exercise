import {jest, test, expect, describe} from "@jest/globals"; // this is optional, all three are global variables im runner scope
import app from './app.js';
import request from 'supertest';

let token;
beforeAll(async () => {
    const authResponse = await request(app)
        .post('/authenticate')
        .auth('Iris', '123')
        .expect(200);

    token = authResponse.body.token;
});
describe('api test for the quiz', () => {

    test('post /authenticate', async () => {
        const response = await request(app)
            .post('/authenticate')
            .auth('Max', '123')
            .expect(200);

        expect(response.body).toHaveProperty('token');
    });

    test('get /questions', async () => {
        const response = await request(app)
            .get('/questions')
            .expect(200);

        expect(response.body).toBeInstanceOf(Array);
    });

    test('get /questions/{questionId}', async () => {
        const response = await request(app)
            .get('/questions/544db309-40cf-4dd8-8662-c10ed3502a5d')
            .expect(200);

        expect(response.body).toHaveProperty('id', '544db309-40cf-4dd8-8662-c10ed3502a5d');
    });

    test('post /game-runs', async () => {
        const response = await request(app)
            .post('/game-runs')
            .set('Authorization', `Bearer ${token}`)
            .expect(201);

        expect(response.body).toHaveProperty('runId');
        expect(response.body).toHaveProperty('userName');
    });

    test('put /game-runs/{runId}/responses', async () => {

        const gameRunResponse = await request(app)
            .post('/game-runs')
            .set('Authorization', `Bearer ${token}`)
            .expect(201);

        const { runId } = gameRunResponse.body;


        const response = await request(app)
            .put(`/game-runs/${runId}/responses`)
            .set('Authorization', `Bearer ${token}`)
            .send({ questionId: '544db309-40cf-4dd8-8662-c10ed3502a5d', answerIndex: '0' })
            .expect(200);

        expect(response.body.responses).toHaveProperty('544db309-40cf-4dd8-8662-c10ed3502a5d', '0');
    });

    test('get /game-runs/{runId}/results', async () => {

        const gameRunResponse = await request(app)
            .post('/game-runs')
            .set('Authorization', `Bearer ${token}`)
            .expect(201);

        const { runId } = gameRunResponse.body;

        const response = await request(app)
            .get(`/game-runs/${runId}/results`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(response.body).toHaveProperty('id', runId);
        expect(response.body).toHaveProperty('responses');
    });


});
