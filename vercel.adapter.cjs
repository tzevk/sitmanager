const baseAdapter = require('@vercel/next/dist/adapter');

module.exports = {
  ...baseAdapter,
  async modifyConfig(config, ctx) {
    if (typeof baseAdapter.modifyConfig !== 'function') {
      return config;
    }

    return baseAdapter.modifyConfig(config, {
      ...ctx,
      projectDir: process.cwd(),
    });
  },
};