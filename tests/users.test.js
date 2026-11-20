const request = require('supertest');
const bcrypt = require('bcrypt');

// On empêche la connexion à la vraie base MongoDB
jest.mock('../models/connection', () => ({}));

// On remplace le modèle User par une fausse version contrôlée par les tests
jest.mock('../models/users', () => {
  const User = jest.fn();
  User.findOne = jest.fn();
  return User;
});

const User = require('../models/users');
const app = require('../app');

beforeEach(() => {
  jest.resetAllMocks();
});

// =====================================
// POST /users/signup

describe('POST /users/signup', () => {
  it('refuse une inscription avec des champs manquants', async () => {
    const res = await request(app)
      .post('/users/signup')
      .send({ firstname: 'John', username: 'johndoe' });

    expect(res.body).toEqual({ result: false, error: 'Missing or empty fields' });
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it('refuse une inscription avec un champ vide', async () => {
    const res = await request(app)
      .post('/users/signup')
      .send({ firstname: 'John', username: '', password: 'azerty' });

    expect(res.body).toEqual({ result: false, error: 'Missing or empty fields' });
  });

  it('refuse un username déjà utilisé', async () => {
    User.findOne.mockResolvedValue({ username: 'johndoe' });

    const res = await request(app)
      .post('/users/signup')
      .send({ firstname: 'John', username: 'johndoe', password: 'azerty' });

    expect(res.body).toEqual({ result: false, error: 'User already exists' });
  });

  it('crée un utilisateur et renvoie ses infos avec un token', async () => {
    User.findOne.mockResolvedValue(null);
    User.mockImplementation((data) => ({
      save: jest.fn().mockResolvedValue({ ...data, _id: 'user123' }),
    }));

    const res = await request(app)
      .post('/users/signup')
      .send({ firstname: 'John', username: 'johndoe', password: 'azerty' });

    expect(res.body.result).toBe(true);
    expect(res.body.firstname).toBe('John');
    expect(res.body.username).toBe('johndoe');
    expect(res.body.userId).toBe('user123');
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token).toHaveLength(32);
  });

  it('enregistre le mot de passe hashé, jamais en clair', async () => {
    User.findOne.mockResolvedValue(null);
    User.mockImplementation((data) => ({
      save: jest.fn().mockResolvedValue({ ...data, _id: 'user123' }),
    }));

    await request(app)
      .post('/users/signup')
      .send({ firstname: 'John', username: 'johndoe', password: 'azerty' });

    const savedData = User.mock.calls[0][0];
    expect(savedData.password).not.toBe('azerty');
    expect(bcrypt.compareSync('azerty', savedData.password)).toBe(true);
  });
});

// =====================================
// POST /users/signin

describe('POST /users/signin', () => {
  const existingUser = {
    _id: 'user123',
    firstname: 'John',
    username: 'johndoe',
    password: bcrypt.hashSync('azerty', 10),
    token: 'token-abc',
  };

  it('refuse une connexion avec des champs manquants', async () => {
    const res = await request(app)
      .post('/users/signin')
      .send({ username: 'johndoe' });

    expect(res.body).toEqual({ result: false, error: 'Missing or empty fields' });
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it('connecte un utilisateur avec les bons identifiants', async () => {
    User.findOne.mockResolvedValue(existingUser);

    const res = await request(app)
      .post('/users/signin')
      .send({ username: 'johndoe', password: 'azerty' });

    expect(res.body).toEqual({
      result: true,
      token: 'token-abc',
      userId: 'user123',
      firstname: 'John',
      username: 'johndoe',
    });
  });

  it('refuse un mauvais mot de passe', async () => {
    User.findOne.mockResolvedValue(existingUser);

    const res = await request(app)
      .post('/users/signin')
      .send({ username: 'johndoe', password: 'mauvais' });

    expect(res.body).toEqual({ result: false, error: 'User not found or wrong password' });
  });

  it('refuse un utilisateur inexistant', async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/users/signin')
      .send({ username: 'inconnu', password: 'azerty' });

    expect(res.body).toEqual({ result: false, error: 'User not found or wrong password' });
  });
});
