module.exports = {
  packagerConfig: {
    name: 'SIT Facescan Relay',
    executableName: 'sit-facescan-relay',
    asar: true,
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'sit_facescan_relay',
        setupExe: 'SIT-Facescan-Relay-Setup.exe',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux'],
    },
  ],
};
