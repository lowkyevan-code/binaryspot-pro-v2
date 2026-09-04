const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;

const smartChartsPackageRoot = path.join(
  projectRoot,
  'node_modules',
  '@deriv-com',
  'smartcharts-champion'
);

const smartChartsDist = path.join(
  smartChartsPackageRoot,
  'dist'
);

const publicRoot = path.join(
  projectRoot,
  'public'
);

const smartChartsPublicRoot = path.join(
  publicRoot,
  'smartcharts'
);

const publicAssetsRoot = path.join(
  publicRoot,
  'assets'
);

function ensureDirectory(directory) {
  fs.mkdirSync(directory, {
    recursive: true,
  });
}

function removeDirectory(directory) {
  if (!fs.existsSync(directory)) {
    return;
  }

  fs.rmSync(directory, {
    recursive: true,
    force: true,
  });
}

function copyDirectory(source, destination) {
  if (!fs.existsSync(source)) {
    return;
  }

  ensureDirectory(destination);

  const entries = fs.readdirSync(
    source,
    {
      withFileTypes: true,
    }
  );

  for (const entry of entries) {
    const sourcePath = path.join(
      source,
      entry.name
    );

    const destinationPath = path.join(
      destination,
      entry.name
    );

    if (entry.isDirectory()) {
      copyDirectory(
        sourcePath,
        destinationPath
      );

      continue;
    }

    if (entry.isFile()) {
      fs.copyFileSync(
        sourcePath,
        destinationPath
      );
    }
  }
}

function prepareSmartChartsRuntime() {
  if (!fs.existsSync(smartChartsDist)) {
    console.warn(
      '[BinarySpot] @deriv-com/smartcharts-champion/dist was not found.'
    );

    return;
  }

  ensureDirectory(publicRoot);

  /*
   * Remove previously copied SmartCharts runtime
   * files so an old package version cannot leave
   * stale chunks behind during a new deployment.
   */
  removeDirectory(
    smartChartsPublicRoot
  );

  ensureDirectory(
    smartChartsPublicRoot
  );

  const distEntries = fs.readdirSync(
    smartChartsDist,
    {
      withFileTypes: true,
    }
  );

  let copiedRuntimeFiles = 0;

  for (const entry of distEntries) {
    if (!entry.isFile()) {
      continue;
    }

    const fileName = entry.name;

    const isSmartChartsChunk =
      fileName.includes(
        '.smartcharts.'
      );

    const isSmartChartsCss =
      fileName ===
      'smartcharts.css';

    if (
      !isSmartChartsChunk &&
      !isSmartChartsCss
    ) {
      continue;
    }

    fs.copyFileSync(
      path.join(
        smartChartsDist,
        fileName
      ),
      path.join(
        smartChartsPublicRoot,
        fileName
      )
    );

    copiedRuntimeFiles += 1;
  }

  /*
   * SmartCharts expects chart assets at
   * /assets/... rather than inside the
   * /smartcharts chunk directory.
   */
  const chartAssetsSource =
    path.join(
      smartChartsDist,
      'chart',
      'assets'
    );

  if (
    fs.existsSync(
      chartAssetsSource
    )
  ) {
    ensureDirectory(
      publicAssetsRoot
    );

    copyDirectory(
      chartAssetsSource,
      publicAssetsRoot
    );
  } else {
    console.warn(
      '[BinarySpot] SmartCharts chart/assets directory was not found.'
    );
  }

  console.log(
    `[BinarySpot] SmartCharts runtime prepared: ${copiedRuntimeFiles} runtime files copied.`
  );
}

prepareSmartChartsRuntime();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

module.exports = nextConfig;
