/*!
  Copyright 2013 Lovell Fuller and others.
  SPDX-License-Identifier: Apache-2.0
*/

// Populate the npm package for the current platform with the local build

const { copyFileSync, cpSync, readFileSync, writeFileSync } = require('node:fs');
const { basename, join } = require('node:path');

const { buildPlatformArch } = require('../dist/libvips.cjs');

const readme = readFileSync(join(__dirname, '..', 'README.md'), 'utf8');
const licensing = readme.substring(readme.indexOf('## Licensing'));

const platform = buildPlatformArch();
const destDir = join(__dirname, platform);
console.log(`Populating npm package for platform: ${platform}`);

// Copy binaries
const releaseDir = join(__dirname, '..', 'src', 'build', 'Release');
const libDir = join(destDir, 'lib');
cpSync(releaseDir, libDir, {
  recursive: true,
  filter: (file) => {
    const name = basename(file);
    return name === 'Release' ||
      (name.startsWith('sharp-') && name.includes('.node')) ||
      (name.startsWith('libvips-') && name.endsWith('.dll'));
  }
});

// Generate README and index.cjs
const { version, name, description } = require(`./${platform}/package.json`);
writeFileSync(join(destDir, 'README.md'), `# \`${name}\`\n\n${description}.\n\n${licensing}`);
const resolveLibvipsBinary = (platform.startsWith('darwin') || platform.startsWith('linux'))
  ? `try { require.resolve('@revizly/sharp-libvips-${platform}/binary'); } catch {}\n`
  : '';
writeFileSync(join(destDir, 'index.cjs'), `${resolveLibvipsBinary}module.exports = require('./lib/sharp-${platform}-${version}.node');`);

// Copy Apache-2.0 LICENSE
copyFileSync(join(__dirname, '..', 'LICENSE'), join(destDir, 'LICENSE'));
