export const getState = () => {
  const { hash } = window.location;
  if (!hash.startsWith('#!')) return {};

  return hash
    .replace('#!', '')
    .split(',')
    .map(s => s.split('='))
    .filter(s => s.length === 2)
    .reduce((all, [key, value]) => Object.assign(all, { [key]: value }), {});
};

export const setState = (state, push = false) => {
  const pairs = Object.entries(state)
    .map(([key, value]) => `${key}=${value}`)
    .join(',');

  if (push) {
    history.pushState(null, '', `#!${pairs}`);
  } else {
    history.replaceState(null, '', `#!${pairs}`);
  }
};
