/*
 * BinarySpot Pro
 * D-Bot XML Asset Loader
 *
 * File:
 *   lib/dbotLoader.js
 *
 * PURPOSE
 * -------
 * Load the ORIGINAL D-Bot XML files stored in:
 *
 *   public/bots/
 *
 * The XML is not rewritten, converted, translated, or modified.
 * It is passed directly into dbotCatalog.js / dbotXmlEngine.js.
 *
 * EXECUTION FLOW
 * --------------
 *
 * public/bots/*.xml
 *        ↓
 * dbotLoader.js
 *        ↓
 * dbotCatalog.js
 *        ↓
 * dbotXmlEngine.js
 *        ↓
 * dbotDerivBridge.js
 *        ↓
 * BinarySpot existing protected Deriv lifecycle
 *
 * IMPORTANT
 * ---------
 * This loader will NOT silently execute an XML bot whose
 * required blocks are unsupported by the current XML engine.
 */

import {
  getDBotCatalog,
  getDBotDefinition,
  loadDBotXml,
} from './dbotCatalog';

export const DBOT_ASSET_DIRECTORY =
  '/bots';

export const DBOT_LOADER_VERSION =
  '1.0.0';

export const DBOT_LOAD_STATUS =
  Object.freeze({
    IDLE: 'IDLE',
    LOADING: 'LOADING',
    LOADED: 'LOADED',
    READY: 'READY',
    UNSUPPORTED: 'UNSUPPORTED',
    NOT_FOUND: 'NOT_FOUND',
    INVALID_XML: 'INVALID_XML',
    NETWORK_ERROR: 'NETWORK_ERROR',
    ERROR: 'ERROR',
  });

function createLoaderError(
  code,
  message,
  details = null
) {
  const error =
    new Error(message);

  error.name =
    'DBotLoaderError';

  error.code =
    code;

  error.details =
    details;

  return error;
}

function normalizeString(
  value
) {
  return String(
    value ?? ''
  ).trim();
}

function encodePathSegment(
  value
) {
  return encodeURIComponent(
    normalizeString(
      value
    )
  );
}

function isXmlFileName(
  value
) {
  return /\.xml$/i.test(
    normalizeString(
      value
    )
  );
}

function ensureXmlFileName(
  value
) {
  const fileName =
    normalizeString(
      value
    );

  if (!fileName) {
    throw createLoaderError(
      'MISSING_FILENAME',
      'No D-Bot XML filename was supplied.'
    );
  }

  if (
    !isXmlFileName(
      fileName
    )
  ) {
    throw createLoaderError(
      'INVALID_FILENAME',
      `D-Bot asset "${fileName}" is not an XML file.`
    );
  }

  if (
    fileName.includes('/') ||
    fileName.includes('\\')
  ) {
    throw createLoaderError(
      'INVALID_FILENAME',
      'D-Bot filenames must not contain directory separators.'
    );
  }

  if (
    fileName === '.' ||
    fileName === '..'
  ) {
    throw createLoaderError(
      'INVALID_FILENAME',
      'Invalid D-Bot filename.'
    );
  }

  return fileName;
}

function normalizeBotReference(
  reference
) {
  if (
    typeof reference ===
    'string'
  ) {
    const definition =
      getDBotDefinition(
        reference
      );

    if (definition) {
      return definition;
    }

    if (
      isXmlFileName(
        reference
      )
    ) {
      return {
        id: null,

        name:
          normalizeString(
            reference
          ).replace(
            /\.xml$/i,
            ''
          ),

        fileName:
          ensureXmlFileName(
            reference
          ),

        registered:
          false,
      };
    }

    throw createLoaderError(
      'UNKNOWN_BOT',
      `No registered D-Bot matches "${reference}".`
    );
  }

  if (
    reference &&
    typeof reference ===
      'object'
  ) {
    if (
      reference.id
    ) {
      const definition =
        getDBotDefinition(
          reference.id
        );

      if (definition) {
        return definition;
      }
    }

    if (
      reference.fileName
    ) {
      const definition =
        getDBotDefinition(
          reference.fileName
        );

      if (definition) {
        return definition;
      }

      return {
        ...reference,

        fileName:
          ensureXmlFileName(
            reference.fileName
          ),

        registered:
          false,
      };
    }
  }

  throw createLoaderError(
    'INVALID_BOT_REFERENCE',
    'A valid D-Bot ID, filename, or catalog definition is required.'
  );
}

export function buildDBotAssetUrl(
  fileName
) {
  const safeFileName =
    ensureXmlFileName(
      fileName
    );

  return (
    `${DBOT_ASSET_DIRECTORY}/` +
    encodePathSegment(
      safeFileName
    )
  );
}

function validateXmlText(
  xmlText,
  fileName
) {
  if (
    typeof xmlText !==
    'string'
  ) {
    throw createLoaderError(
      'INVALID_XML_RESPONSE',
      `The asset "${fileName}" did not return text content.`
    );
  }

  const trimmed =
    xmlText.trim();

  if (!trimmed) {
    throw createLoaderError(
      'EMPTY_XML',
      `The D-Bot XML file "${fileName}" is empty.`
    );
  }

  /*
   * This is intentionally only a lightweight transport-level
   * check.
   *
   * dbotXmlEngine.js performs the actual XML parsing and
   * structural validation.
   */
  if (
    !trimmed.startsWith(
      '<'
    )
  ) {
    throw createLoaderError(
      'INVALID_XML_RESPONSE',
      `The asset "${fileName}" did not return XML content.`
    );
  }

  return xmlText;
}

async function fetchXmlAsset(
  fileName,
  options = {}
) {
  const {
    signal,
    cache = 'no-store',
  } = options;

  const url =
    buildDBotAssetUrl(
      fileName
    );

  let response;

  try {
    response =
      await fetch(
        url,
        {
          method: 'GET',

          signal,

          cache,

          headers: {
            Accept:
              'application/xml,text/xml,text/plain,*/*',
          },
        }
      );
  } catch (error) {
    if (
      error?.name ===
      'AbortError'
    ) {
      throw createLoaderError(
        'LOAD_ABORTED',
        `Loading "${fileName}" was cancelled.`,
        {
          fileName,
          url,
        }
      );
    }

    throw createLoaderError(
      'NETWORK_ERROR',
      `Could not load D-Bot XML asset "${fileName}".`,
      {
        fileName,
        url,
        cause:
          error?.message ||
          String(error),
      }
    );
  }

  if (
    response.status ===
    404
  ) {
    throw createLoaderError(
      'NOT_FOUND',
      `D-Bot XML asset "${fileName}" was not found in public/bots/.`,
      {
        fileName,
        url,
        status:
          response.status,
      }
    );
  }

  if (
    !response.ok
  ) {
    throw createLoaderError(
      'HTTP_ERROR',
      `Failed to load "${fileName}" (HTTP ${response.status}).`,
      {
        fileName,
        url,
        status:
          response.status,
      }
    );
  }

  const xmlText =
    await response.text();

  return {
    url,

    xmlText:
      validateXmlText(
        xmlText,
        fileName
      ),

    response,
  };
}

function getUnsupportedBlocks(
  loadedBot
) {
  const unsupported =
    loadedBot
      ?.compatibility
      ?.unsupportedBlocks;

  if (
    !Array.isArray(
      unsupported
    )
  ) {
    return [];
  }

  return unsupported.map(
    (block) => ({
      ...block,
    })
  );
}

function createLoadResult({
  definition,
  loadedBot,
  assetUrl,
}) {
  const unsupportedBlocks =
    getUnsupportedBlocks(
      loadedBot
    );

  const executable =
    Boolean(
      loadedBot
        ?.compatibility
        ?.executable
    );

  return {
    id:
      loadedBot?.id ||
      definition?.id ||
      null,

    name:
      loadedBot?.name ||
      definition?.name ||
      null,

    fileName:
      loadedBot?.fileName ||
      definition?.fileName ||
      null,

    family:
      loadedBot?.family ||
      definition?.family ||
      null,

    assetUrl,

    registered:
      Boolean(
        loadedBot
          ?.registered
      ),

    status:
      executable
        ? DBOT_LOAD_STATUS
            .READY
        : DBOT_LOAD_STATUS
            .UNSUPPORTED,

    executable,

    unsupportedBlocks,

    loadedBot,

    model:
      loadedBot?.model ||
      null,

    inspection:
      loadedBot?.inspection ||
      null,

    compatibility:
      loadedBot
        ?.compatibility ||
      null,

    trade:
      loadedBot?.trade ||
      null,

    risk:
      loadedBot?.risk ||
      null,

    createRuntime(
      options = {}
    ) {
      if (
        !executable
      ) {
        const blockTypes =
          unsupportedBlocks
            .map(
              (block) =>
                block.type ||
                block.blockType ||
                'unknown'
            )
            .filter(
              Boolean
            );

        throw createLoaderError(
          'UNSUPPORTED_BLOCKS',
          blockTypes.length
            ? `The XML bot cannot start yet because the engine does not support: ${[
                ...new Set(
                  blockTypes
                ),
              ].join(', ')}.`
            : 'The XML bot cannot start because its complete block set is not supported yet.',
          {
            botId:
              loadedBot?.id ||
              null,

            fileName:
              loadedBot
                ?.fileName ||
              null,

            unsupportedBlocks,
          }
        );
      }

      /*
       * The catalog creates the runtime directly from the
       * parsed original XML model.
       */
      return loadedBot.createRuntime(
        options
      );
    },

    assertExecutable() {
      if (
        !executable
      ) {
        throw createLoaderError(
          'BOT_NOT_EXECUTABLE',
          `D-Bot "${loadedBot?.name || definition?.name || 'Unknown'}" is not fully supported by the current XML engine.`,
          {
            unsupportedBlocks,
          }
        );
      }

      return loadedBot
        .assertExecutable();
    },
  };
}

export async function loadDBotAsset(
  reference,
  options = {}
) {
  const definition =
    normalizeBotReference(
      reference
    );

  const fileName =
    ensureXmlFileName(
      definition.fileName
    );

  const {
    xmlText,
    url,
  } =
    await fetchXmlAsset(
      fileName,
      options
    );

  let loadedBot;

  try {
    loadedBot =
      loadDBotXml(
        xmlText,
        {
          fileName,

          expectedBotId:
            definition.registered ===
              false
              ? null
              : definition.id ||
                null,
        }
      );
  } catch (error) {
    if (
      error?.name ===
      'DBotLoaderError'
    ) {
      throw error;
    }

    throw createLoaderError(
      'INVALID_XML',
      `Could not parse D-Bot XML "${fileName}": ${
        error?.message ||
        String(error)
      }`,
      {
        fileName,
        url,
        cause:
          error?.message ||
          String(error),
      }
    );
  }

  return createLoadResult({
    definition,
    loadedBot,
    assetUrl:
      url,
  });
}

export async function loadDBotAssetById(
  botId,
  options = {}
) {
  const definition =
    getDBotDefinition(
      botId
    );

  if (!definition) {
    throw createLoaderError(
      'UNKNOWN_BOT',
      `D-Bot "${botId}" is not registered in the catalog.`
    );
  }

  return loadDBotAsset(
    definition,
    options
  );
}

export async function inspectDBotAsset(
  reference,
  options = {}
) {
  const result =
    await loadDBotAsset(
      reference,
      options
    );

  return {
    id:
      result.id,

    name:
      result.name,

    fileName:
      result.fileName,

    family:
      result.family,

    assetUrl:
      result.assetUrl,

    registered:
      result.registered,

    status:
      result.status,

    executable:
      result.executable,

    unsupportedBlocks:
      result.unsupportedBlocks,

    inspection:
      result.inspection,

    compatibility:
      result.compatibility,

    trade:
      result.trade,

    risk:
      result.risk,
  };
}

export async function checkDBotAssetExists(
  reference,
  options = {}
) {
  let definition;

  try {
    definition =
      normalizeBotReference(
        reference
      );
  } catch (error) {
    return {
      exists: false,

      error:
        error?.message ||
        String(error),
    };
  }

  const fileName =
    definition.fileName;

  const url =
    buildDBotAssetUrl(
      fileName
    );

  try {
    const response =
      await fetch(
        url,
        {
          method: 'HEAD',

          signal:
            options.signal,

          cache:
            'no-store',
        }
      );

    /*
     * Some static hosts may not support HEAD correctly.
     * If HEAD is explicitly rejected, fall back to GET.
     */
    if (
      response.status ===
        405 ||
      response.status ===
        501
    ) {
      const fallback =
        await fetch(
          url,
          {
            method: 'GET',

            signal:
              options.signal,

            cache:
              'no-store',
          }
        );

      return {
        exists:
          fallback.ok,

        status:
          fallback.status,

        fileName,

        url,
      };
    }

    return {
      exists:
        response.ok,

      status:
        response.status,

      fileName,

      url,
    };
  } catch (error) {
    return {
      exists: false,

      fileName,

      url,

      error:
        error?.message ||
        String(error),
    };
  }
}

export async function checkRegisteredDBotAssets(
  options = {}
) {
  const catalog =
    getDBotCatalog();

  const results = [];

  for (
    const definition of
    catalog
  ) {
    if (
      options.signal
        ?.aborted
    ) {
      throw createLoaderError(
        'LOAD_ABORTED',
        'D-Bot asset check was cancelled.'
      );
    }

    const result =
      await checkDBotAssetExists(
        definition,
        options
      );

    results.push({
      id:
        definition.id,

      name:
        definition.name,

      fileName:
        definition.fileName,

      family:
        definition.family,

      ...result,
    });
  }

  return results;
}

export async function loadRegisteredDBotAssets(
  options = {}
) {
  const catalog =
    getDBotCatalog();

  const results = [];

  for (
    const definition of
    catalog
  ) {
    if (
      options.signal
        ?.aborted
    ) {
      throw createLoaderError(
        'LOAD_ABORTED',
        'D-Bot loading was cancelled.'
      );
    }

    try {
      const result =
        await loadDBotAsset(
          definition,
          options
        );

      results.push({
        ok: true,

        ...result,
      });
    } catch (error) {
      results.push({
        ok: false,

        id:
          definition.id,

        name:
          definition.name,

        fileName:
          definition.fileName,

        family:
          definition.family,

        status:
          error?.code ===
            'NOT_FOUND'
            ? DBOT_LOAD_STATUS
                .NOT_FOUND
            : error?.code ===
                'INVALID_XML'
              ? DBOT_LOAD_STATUS
                  .INVALID_XML
              : error?.code ===
                    'NETWORK_ERROR'
                ? DBOT_LOAD_STATUS
                    .NETWORK_ERROR
                : DBOT_LOAD_STATUS
                    .ERROR,

        error: {
          name:
            error?.name ||
            'Error',

          code:
            error?.code ||
            'UNKNOWN_ERROR',

          message:
            error?.message ||
            String(error),

          details:
            error?.details ||
            null,
        },
      });
    }
  }

  return results;
}

export function createDBotAssetLoader(
  options = {}
) {
  let state = {
    status:
      DBOT_LOAD_STATUS
        .IDLE,

    loading:
      false,

    selectedBot:
      null,

    error:
      null,
  };

  let controller =
    null;

  const listeners =
    new Set();

  function emit() {
    const snapshot =
      getState();

    for (
      const listener of
      listeners
    ) {
      try {
        listener(
          snapshot
        );
      } catch (error) {
        console.error(
          '[D-Bot Loader] Listener error:',
          error
        );
      }
    }

    options.onStateChange?.(
      snapshot
    );
  }

  function setState(
    update
  ) {
    state = {
      ...state,
      ...update,
    };

    emit();
  }

  function getState() {
    return {
      ...state,
    };
  }

  function subscribe(
    listener
  ) {
    if (
      typeof listener !==
      'function'
    ) {
      throw createLoaderError(
        'INVALID_LISTENER',
        'Loader subscriber must be a function.'
      );
    }

    listeners.add(
      listener
    );

    listener(
      getState()
    );

    return () => {
      listeners.delete(
        listener
      );
    };
  }

  function cancel() {
    if (controller) {
      controller.abort();

      controller =
        null;
    }
  }

  async function load(
    reference
  ) {
    cancel();

    controller =
      new AbortController();

    setState({
      status:
        DBOT_LOAD_STATUS
          .LOADING,

      loading: true,

      error: null,
    });

    try {
      const result =
        await loadDBotAsset(
          reference,
          {
            signal:
              controller.signal,

            cache:
              options.cache ||
              'no-store',
          }
        );

      setState({
        status:
          result.status,

        loading: false,

        selectedBot:
          result,

        error: null,
      });

      controller =
        null;

      return result;
    } catch (error) {
      const code =
        error?.code ||
        'ERROR';

      let status =
        DBOT_LOAD_STATUS
          .ERROR;

      if (
        code ===
        'NOT_FOUND'
      ) {
        status =
          DBOT_LOAD_STATUS
            .NOT_FOUND;
      } else if (
        code ===
        'INVALID_XML'
      ) {
        status =
          DBOT_LOAD_STATUS
            .INVALID_XML;
      } else if (
        code ===
        'NETWORK_ERROR'
      ) {
        status =
          DBOT_LOAD_STATUS
            .NETWORK_ERROR;
      }

      setState({
        status,

        loading: false,

        selectedBot:
          null,

        error: {
          name:
            error?.name ||
            'Error',

          code,

          message:
            error?.message ||
            String(error),

          details:
            error?.details ||
            null,
        },
      });

      controller =
        null;

      throw error;
    }
  }

  function clear() {
    cancel();

    state = {
      status:
        DBOT_LOAD_STATUS
          .IDLE,

      loading: false,

      selectedBot:
        null,

      error: null,
    };

    emit();
  }

  return {
    load,

    clear,

    cancel,

    subscribe,

    getState,

    get selectedBot() {
      return state
        .selectedBot;
    },

    get loading() {
      return state.loading;
    },
  };
}

export function getDBotLoaderVersion() {
  return DBOT_LOADER_VERSION;
}

export default {
  load:
    loadDBotAsset,

  loadById:
    loadDBotAssetById,

  inspect:
    inspectDBotAsset,

  checkExists:
    checkDBotAssetExists,

  checkRegistered:
    checkRegisteredDBotAssets,

  loadRegistered:
    loadRegisteredDBotAssets,

  createLoader:
    createDBotAssetLoader,

  buildAssetUrl:
    buildDBotAssetUrl,

  getVersion:
    getDBotLoaderVersion,
};
