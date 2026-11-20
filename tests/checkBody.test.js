const { checkBody } = require('../modules/checkBody');

describe('checkBody', () => {
  it('renvoie true quand tous les champs sont remplis', () => {
    const body = { firstname: 'John', username: 'johndoe', password: 'azerty' };

    expect(checkBody(body, ['firstname', 'username', 'password'])).toBe(true);
  });

  it('renvoie false quand un champ est manquant', () => {
    const body = { firstname: 'John', username: 'johndoe' };

    expect(checkBody(body, ['firstname', 'username', 'password'])).toBe(false);
  });

  it('renvoie false quand un champ est une chaîne vide', () => {
    const body = { firstname: 'John', username: '', password: 'azerty' };

    expect(checkBody(body, ['firstname', 'username', 'password'])).toBe(false);
  });

  it('renvoie false quand un champ vaut null ou undefined', () => {
    expect(checkBody({ username: null }, ['username'])).toBe(false);
    expect(checkBody({ username: undefined }, ['username'])).toBe(false);
  });

  it('renvoie false quand le body est vide', () => {
    expect(checkBody({}, ['username', 'password'])).toBe(false);
  });

  it('renvoie true quand aucun champ n\'est requis', () => {
    expect(checkBody({}, [])).toBe(true);
  });

  it('ignore les champs supplémentaires non demandés', () => {
    const body = { username: 'johndoe', password: 'azerty', extra: '' };

    expect(checkBody(body, ['username', 'password'])).toBe(true);
  });
});
