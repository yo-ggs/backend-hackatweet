const request = require('supertest');
const mongoose = require('mongoose');

// On empêche la connexion à la vraie base MongoDB
jest.mock('../models/connection', () => ({}));

// On remplace les modèles par de fausses versions contrôlées par les tests
jest.mock('../models/users', () => ({
  findOne: jest.fn(),
}));

jest.mock('../models/tweets', () => ({
  find: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  findOneAndDelete: jest.fn(),
}));

const User = require('../models/users');
const Tweet = require('../models/tweets');
const app = require('../app');

// Données de test
const newId = () => new mongoose.Types.ObjectId().toString();
const user = { _id: newId(), firstname: 'John', username: 'johndoe', token: 'token-abc' };
const otherUserId = newId();
const auth = { Authorization: 'Bearer token-abc' };

beforeEach(() => {
  jest.resetAllMocks();
  // On masque les console.error des routes quand on teste les erreurs 500
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

// =====================================
// GET /tweets

describe('GET /tweets', () => {
  it('renvoie tous les tweets, triés du plus récent au plus ancien, avec l\'auteur', async () => {
    const tweets = [{ content: 'Récent' }, { content: 'Ancien' }];
    const sort = jest.fn().mockResolvedValue(tweets);
    const populate = jest.fn().mockReturnValue({ sort });
    Tweet.find.mockReturnValue({ populate });

    const res = await request(app).get('/tweets');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ result: true, tweets });
    expect(populate).toHaveBeenCalledWith('author', 'firstname username');
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
  });

  it('renvoie une erreur 500 si la base plante', async () => {
    Tweet.find.mockImplementation(() => {
      throw new Error('DB down');
    });

    const res = await request(app).get('/tweets');

    expect(res.status).toBe(500);
    expect(res.body.result).toBe(false);
  });
});

// =====================================
// GET /tweets/search

describe('GET /tweets/search', () => {
  it('refuse une recherche sans paramètre query', async () => {
    const res = await request(app).get('/tweets/search');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ result: false, error: 'Recherche invalide' });
  });

  it('refuse une recherche vide (que des espaces)', async () => {
    const res = await request(app).get('/tweets/search').query({ query: '   ' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ result: false, error: 'Recherche vide' });
  });

  it('refuse une recherche de plus de 100 caractères', async () => {
    const res = await request(app).get('/tweets/search').query({ query: 'a'.repeat(101) });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ result: false, error: 'Recherche trop longue' });
  });

  it('cherche sans tenir compte de la casse et renvoie les résultats', async () => {
    const tweets = [{ content: 'Hello world' }];
    Tweet.find.mockResolvedValue(tweets);

    const res = await request(app).get('/tweets/search').query({ query: 'hello' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ result: true, tweets });
    expect(Tweet.find).toHaveBeenCalledWith({
      content: { $regex: 'hello', $options: 'i' },
    });
  });

  it('échappe les caractères spéciaux des regex', async () => {
    Tweet.find.mockResolvedValue([]);

    await request(app).get('/tweets/search').query({ query: 'a.b*' });

    expect(Tweet.find).toHaveBeenCalledWith({
      content: { $regex: 'a\\.b\\*', $options: 'i' },
    });
  });
});

// =====================================
// GET /tweets/user/:userId

describe('GET /tweets/user/:userId', () => {
  it('refuse un identifiant invalide', async () => {
    const res = await request(app).get('/tweets/user/pas-un-id');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ result: false, error: 'Identifiant invalide' });
  });

  it('renvoie uniquement les tweets de cet utilisateur', async () => {
    const tweets = [{ content: 'Mon tweet', author: user._id }];
    Tweet.find.mockResolvedValue(tweets);

    const res = await request(app).get(`/tweets/user/${user._id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ result: true, tweets });
    expect(Tweet.find).toHaveBeenCalledWith({ author: user._id });
  });
});

// =====================================
// POST /tweets

describe('POST /tweets', () => {
  it('refuse un tweet vide', async () => {
    const res = await request(app).post('/tweets').set(auth).send({ content: '   ' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ result: false, error: 'Le tweet est vide ou invalide' });
  });

  it('refuse un contenu qui n\'est pas du texte', async () => {
    const res = await request(app).post('/tweets').set(auth).send({ content: 123 });

    expect(res.status).toBe(400);
  });

  it('refuse un tweet de plus de 280 caractères', async () => {
    const res = await request(app).post('/tweets').set(auth).send({ content: 'a'.repeat(281) });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      result: false,
      error: 'Le tweet ne doit pas dépasser 280 caractères',
    });
  });

  it('accepte un tweet de exactement 280 caractères', async () => {
    User.findOne.mockResolvedValue(user);
    Tweet.create.mockResolvedValue({ content: 'a'.repeat(280) });

    const res = await request(app).post('/tweets').set(auth).send({ content: 'a'.repeat(280) });

    expect(res.status).toBe(201);
  });

  it('refuse une requête sans token', async () => {
    const res = await request(app).post('/tweets').send({ content: 'Hello' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ result: false, error: 'Token manquant ou invalide' });
  });

  it('refuse un token inconnu', async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/tweets')
      .set({ Authorization: 'Bearer faux-token' })
      .send({ content: 'Hello' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ result: false, error: 'Utilisateur non authentifié' });
    expect(Tweet.create).not.toHaveBeenCalled();
  });

  it('crée le tweet avec le bon auteur et le contenu nettoyé', async () => {
    User.findOne.mockResolvedValue(user);
    Tweet.create.mockImplementation(async (data) => ({ _id: newId(), ...data }));

    const res = await request(app).post('/tweets').set(auth).send({ content: '  Hello  ' });

    expect(res.status).toBe(201);
    expect(res.body.result).toBe(true);
    expect(User.findOne).toHaveBeenCalledWith({ token: 'token-abc' });
    expect(Tweet.create).toHaveBeenCalledWith({
      content: 'Hello',
      author: user._id,
      likes: [],
    });
  });
});

// =====================================
// POST /tweets/:id/like

describe('POST /tweets/:id/like', () => {
  const tweetId = newId();

  it('refuse un identifiant de tweet invalide', async () => {
    const res = await request(app).post('/tweets/pas-un-id/like').set(auth);

    expect(res.status).toBe(400);
  });

  it('refuse une requête sans token', async () => {
    const res = await request(app).post(`/tweets/${tweetId}/like`);

    expect(res.status).toBe(401);
  });

  it('renvoie 404 si le tweet n\'existe pas', async () => {
    User.findOne.mockResolvedValue(user);
    Tweet.findById.mockResolvedValue(null);

    const res = await request(app).post(`/tweets/${tweetId}/like`).set(auth);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ result: false, error: 'Tweet introuvable' });
  });

  it('like un tweet pas encore liké', async () => {
    const tweet = { likes: [], save: jest.fn().mockResolvedValue() };
    User.findOne.mockResolvedValue(user);
    Tweet.findById.mockResolvedValue(tweet);

    const res = await request(app).post(`/tweets/${tweetId}/like`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ result: true, liked: true, likesCount: 1 });
    expect(tweet.save).toHaveBeenCalled();
  });

  it('unlike un tweet déjà liké', async () => {
    const tweet = { likes: [user._id, otherUserId], save: jest.fn().mockResolvedValue() };
    User.findOne.mockResolvedValue(user);
    Tweet.findById.mockResolvedValue(tweet);

    const res = await request(app).post(`/tweets/${tweetId}/like`).set(auth);

    expect(res.body).toEqual({ result: true, liked: false, likesCount: 1 });
    expect(tweet.likes).toEqual([otherUserId]);
  });
});

// =====================================
// DELETE /tweets/:id

describe('DELETE /tweets/:id', () => {
  const tweetId = newId();

  it('refuse un identifiant invalide', async () => {
    const res = await request(app).delete('/tweets/pas-un-id').set(auth);

    expect(res.status).toBe(400);
  });

  it('refuse une requête sans token', async () => {
    const res = await request(app).delete(`/tweets/${tweetId}`);

    expect(res.status).toBe(401);
  });

  it('renvoie 404 si le tweet n\'existe pas', async () => {
    User.findOne.mockResolvedValue(user);
    Tweet.findById.mockResolvedValue(null);

    const res = await request(app).delete(`/tweets/${tweetId}`).set(auth);

    expect(res.status).toBe(404);
  });

  it('interdit de supprimer le tweet de quelqu\'un d\'autre', async () => {
    User.findOne.mockResolvedValue(user);
    Tweet.findById.mockResolvedValue({ _id: tweetId, author: otherUserId });

    const res = await request(app).delete(`/tweets/${tweetId}`).set(auth);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ result: false, error: 'Vous ne pouvez pas supprimer ce tweet' });
    expect(Tweet.findOneAndDelete).not.toHaveBeenCalled();
  });

  it('supprime son propre tweet', async () => {
    const tweet = { _id: tweetId, author: user._id };
    User.findOne.mockResolvedValue(user);
    Tweet.findById.mockResolvedValue(tweet);
    Tweet.findOneAndDelete.mockResolvedValue(tweet);

    const res = await request(app).delete(`/tweets/${tweetId}`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ result: true, message: 'Tweet supprimé' });
    expect(Tweet.findOneAndDelete).toHaveBeenCalledWith({ _id: tweetId, author: user._id });
  });
});
