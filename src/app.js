import express, {json} from 'express';
import fs from "fs";
import path from 'path';
import {read, write} from "./tools/json-files.js";
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import passport from 'passport';
import {BasicStrategy} from 'passport-http';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json())

passport.use(new BasicStrategy(
    async function(userid, password, done) {
        try {
            const users = read ("users")
            const user = users.find(user => user.userName === userid);
            if (user) {
                const isCorrect = await bcrypt.compare(password, user.password);
                if(isCorrect) {
                    done(null, user);
                } else {
                    done(null, false);
                }
            } else {
                done(null, false);
            }
        } catch (err) {
            done(err);
        }
    }
));

const opts = {}
opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
opts.secretOrKey = 'my-secret';

passport.use(new JwtStrategy(opts,
    function(jwtPayload, done) {
        done(null, jwtPayload);
    }
));

app.use(passport.initialize());

app.post('/authenticate', (req, res, next) => {
    passport.authenticate('basic', { session: false }, (err, user, info) => {
        if (err) { return next(err); }
        if (!user) { return res.status(401).json({ message: info.message }); }
        const token = jwt.sign({ subject: user.userName, name: user.name, roles: user.roles }, 'my-secret', { expiresIn: '1h' });
        return res.json({ token });
    })(req, res, next);
});

app.get('/questions', async (req, res) => {
    try {
        const questions = read("questions");
        const noAnswer = questions.map(question=>({
            id: question.id,
            question: question.question,
            options: question.options
        }))
        res.json(noAnswer);

    } catch (error) {
        console.error('404 Not found ', error);
    }

});

app.get('/questions/:questionId', async (req, res) => {
 try {
     const questionID = req.params.questionId;
     const questionsArray = read("questions")
     const question = questionsArray.map(question=>({
         id: question.id,
         question: question.question,
         options: question.options
     })).find((question) => question.id === questionID)

     res.json(question);
 }catch (error){
     console.error('404 Not found ', error);
 }
    });

const isAuthenticated = (req, res, next) => {
    passport.authenticate('jwt', { session: false }, (err, user, info) => {
        if (err || !user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        req.user = user;
        next();
    })(req, res, next);
};
app.post('/game-runs', isAuthenticated, (req, res) => {
    console.log('Authenticated user:', req.user);
    let gameRuns = read('game-runs.json')

    if (!Array.isArray(gameRuns)) {
        gameRuns = [];
    }
        const newGameRun = {
            id: uuidv4(),
            userName: req.user.subject,
            createdAt: Date.now(),
            responses: {}
        };

    console.log(newGameRun)

    gameRuns.push(newGameRun);

    write('game-runs.json', gameRuns);

    res.status(201).send({ runId: newGameRun.id, userName: newGameRun.userName });
});

app.put('/game-runs/:runId/responses', isAuthenticated,(req, res) => {
    const gameRuns = read('game-runs.json');
    const { runId } = req.params;
    const newResponses = req.body;

    console.log(runId, newResponses);

    const answerIndex = gameRuns.findIndex(run => run.id === runId);

    const gameRun = gameRuns[answerIndex];

    if (gameRun.userName !== req.user.subject) {
        return res.status(403).json({ message: 'Unauthorized: You are not the owner of this game run' });
    }

    gameRun.responses = {
        ...gameRun.responses,
        [newResponses.questionId]: newResponses.answerIndex
    };

    gameRuns[answerIndex] = gameRun;

    write('game-runs.json', gameRuns);

     res.json(gameRun);
});


app.get("/game-runs/:runId/results" , isAuthenticated,
    (req, res) => {
        const {runId} = req.params;
        const gameRuns = read('game-runs.json');
        const questions = read('questions.json');

        const gameRun = gameRuns.find(run => run.id === runId);

        if (gameRun.userName !== req.user.subject) {
            return res.status(403).json({ message: 'Unauthorized: You are not the owner of this game run' });
        }

        const result = {}

        const questionIds = Object.keys(gameRun.responses)
        for (const questionId of questionIds){
            const question = questions.find(question => question.id === questionId);
            result[questionId] = question.correctAnswer == gameRun.responses[questionId];
        }

        const responseObject = {
            id: gameRun.id,
            userName: gameRun.userName,
            createdAt: gameRun.createdAt,
            responses: result
        };
        res.send(responseObject);
    })



export default app