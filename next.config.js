const fs = require('fs');
const path = require('path');

function ensureDirectory(directory) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, {
      recursive: true,
    });
  }
}

function copyDirectory(source, destination) {
  if (!fs.existsSync(source)) {
    return;
  }

  ensureDirectory(destination);

  for (const entry of fs.readdirSync(source, {
    withFileTypes: true,
  })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destinationPath);
      continue;
    }

    fs.copyFileSync(sourcePath, destinationPath);
  }
}

function prepareSmartChartsAssets() {
  const projectRoot = process.cwd();

  const smartChartsDist = path.join(
    projectRoot,
    'node_modules',
    '@deriv-com',
    'smartcharts-champion',
    'dist'
  );

  if (!fs.existsSync(smartChartsDist)) {
    console.warn(
      '[BinarySpot] SmartCharts package is not installed yet. Skipping asset copy.'
    );
    return;
  }

  const publicDirectory = path.join(
    projectRoot,
    'public'
  );

  const smartChartsPublicDirectory = path.join(
    publicDirectory,
    'smartcharts'
  );

  const rootAssetsDirectory = path.join(
    publicDirectory,
    'assets'
  );

  ensureDirectory(publicDirectory);
  ensureDirectory(smartChartsPublicDirectory);
  ensureDirectory(rootAssetsDirectory);

  const distEntries = fs.readdirSync(
    smartChartsDist,
    {
      withFileTypes: true,
    }
  );

  for (const entry of distEntries) {
    if (!entry.isFile()) {
      continue;
    }

    const isSmartChartsChunk =
      entry.name.includes('.smartcharts.');

    const isSmartChartsCss =
      entry.name === 'smartcharts.css';

    if (
      !isSmartChartsChunk &&
      !isSmartChartsCss
    ) {
      continue;
    }

    fs.copyFileSync(
      path.join(
        smartChartsDist,
        entry.name
      ),
      path.join(
        smartChartsPublicDirectory,
        entry.name
      )
    );
  }

  const chartAssetsSource = path.join(
    smartChartsDist,
    'chart',
    'assets'
  );

  copyDirectory(
    chartAssetsSource,
    rootAssetsDirectory
  );

  console.log(
    '[BinarySpot] SmartCharts runtime assets prepared.'
  );
}

prepareSmartChartsAssets();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  transpilePackages: [
    '@deriv-com/smartcharts-champion',
  ],

  webpack(config) {
    return config;
  },
};

module.exports = nextConfig;
