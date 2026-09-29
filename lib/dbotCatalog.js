/*
 * BinarySpot Pro
 * D-Bot Catalog
 *
 * File:
 *   lib/dbotCatalog.js
 *
 * Purpose:
 *   Register and load original D-Bot XML strategies.
 *
 * IMPORTANT:
 *   This catalog DOES NOT recreate bot strategies.
 *   It DOES NOT replace XML logic with BinarySpot logic.
 *   It DOES NOT override stake, martingale, TP, SL,
 *   prediction, switching, recovery, or entry rules.
 *
 *   The XML remains the source of truth.
 */

import {
  parseDBotXml,
  parseDBotFile,
  createDBotRuntime,
  inspectDBotModel,
  assertDBotExecutable,
} from './dbotXmlEngine';

export const DBOT_FAMILIES =
  Object.freeze({
    EVEN_ODD:
      'EVEN_ODD',

    OVER_UNDER:
      'OVER_UNDER',

    MATCHES_DIFFERS:
      'MATCHES_DIFFERS',

    RISE_FALL:
      'RISE_FALL',

    ACCUMULATOR:
      'ACCUMULATOR',

    UNKNOWN:
      'UNKNOWN',
  });

export const DBOT_SOURCE_TYPES =
  Object.freeze({
    BUNDLED:
      'BUNDLED',

    UPLOADED:
      'UPLOADED',
  });

export const DBOT_EXECUTION_STATUS =
  Object.freeze({
    NOT_LOADED:
      'NOT_LOADED',

    LOADED:
      'LOADED',

    READY:
      'READY',

    UNSUPPORTED:
      'UNSUPPORTED',

    INVALID:
      'INVALID',
  });

const BOT_DEFINITIONS = [
  {
    id:
      'even-odd-switcher-ii',

    name:
      'Even Odd Switcher II',

    fileName:
      'Even Odd Switcher II.xml',

    family:
      DBOT_FAMILIES.EVEN_ODD,

    sourceType:
      DBOT_SOURCE_TYPES.BUNDLED,

    description:
      'Original Even/Odd D-Bot XML strategy.',

    aliases: [
      'even odd switcher',
      'even odd switcher ii',
      'evenodd switcher ii',
    ],
  },

  {
    id:
      'over-5-under-5-dbot',

    name:
      'OVER 5 UNDER 5 D-Bot',

    fileName:
      'OVER 5 UNDER 5 D-Bot.xml',

    family:
      DBOT_FAMILIES.OVER_UNDER,

    sourceType:
      DBOT_SOURCE_TYPES.BUNDLED,

    description:
      'Original Over/Under D-Bot XML strategy.',

    aliases: [
      'over 5 under 5',
      'over 5 under 5 d-bot',
      'over 5 under 5 dbot',
    ],
  },

  {
    id:
      'under-8-king-bot',

    name:
      'Under 8 King Bot',

    fileName:
      'Under 8 King Bot.xml',

    family:
      DBOT_FAMILIES.OVER_UNDER,

    sourceType:
      DBOT_SOURCE_TYPES.BUNDLED,

    description:
      'Original Digit Under D-Bot XML strategy.',

    aliases: [
      'under 8 king',
      'under 8 king bot',
    ],
  },

  {
    id:
      'differ-range-0-9',

    name:
      '(0-9) Differ Range',

    fileName:
      '(0-9) Differ range.xml',

    family:
      DBOT_FAMILIES.MATCHES_DIFFERS,

    sourceType:
      DBOT_SOURCE_TYPES.BUNDLED,

    description:
      'Original Matches/Differs D-Bot XML strategy.',

    aliases: [
      '0-9 differ range',
      'differ range',
      'differ range 0-9',
    ],
  },
];

function normalizeText(
  value
) {
  return String(
    value ?? ''
  )
    .trim()
    .toLowerCase();
}

function normalizeFileName(
  value
) {
  return normalizeText(
    value
  ).replace(
    /\\/g,
    '/'
  );
}

function cloneDefinition(
  definition
) {
  if (!definition) {
    return null;
  }

  return {
    ...definition,

    aliases: [
      ...(
        definition.aliases ||
        []
      ),
    ],
  };
}

function inferFamilyFromTrade(
  trade
) {
  const tradeType =
    normalizeText(
      trade?.tradeType
    );

  const category =
    normalizeText(
      trade?.tradeTypeCategory
    );

  const contractSelection =
    normalizeText(
      trade?.contractSelection
    );

  const availableContracts =
    (
      trade?.availableContracts ||
      []
    ).map(
      normalizeText
    );

  if (
    tradeType.includes(
      'evenodd'
    ) ||
    availableContracts.includes(
      'digiteven'
    ) ||
    availableContracts.includes(
      'digitodd'
    )
  ) {
    return DBOT_FAMILIES
      .EVEN_ODD;
  }

  if (
    tradeType.includes(
      'overunder'
    ) ||
    availableContracts.includes(
      'digitover'
    ) ||
    availableContracts.includes(
      'digitunder'
    ) ||
    contractSelection.includes(
      'digitover'
    ) ||
    contractSelection.includes(
      'digitunder'
    )
  ) {
    return DBOT_FAMILIES
      .OVER_UNDER;
  }

  if (
    tradeType.includes(
      'matchesdiffers'
    ) ||
    tradeType.includes(
      'matchdiff'
    ) ||
    availableContracts.includes(
      'digitmatch'
    ) ||
    availableContracts.includes(
      'digitdiff'
    )
  ) {
    return DBOT_FAMILIES
      .MATCHES_DIFFERS;
  }

  if (
    tradeType.includes(
      'callput'
    ) ||
    availableContracts.includes(
      'call'
    ) ||
    availableContracts.includes(
      'put'
    )
  ) {
    return DBOT_FAMILIES
      .RISE_FALL;
  }

  if (
    tradeType.includes(
      'accumulator'
    ) ||
    category.includes(
      'accumulator'
    ) ||
    availableContracts.includes(
      'accu'
    )
  ) {
    return DBOT_FAMILIES
      .ACCUMULATOR;
  }

  return DBOT_FAMILIES
    .UNKNOWN;
}

function findDefinitionByFileName(
  fileName
) {
  const normalized =
    normalizeFileName(
      fileName
    );

  if (!normalized) {
    return null;
  }

  return (
    BOT_DEFINITIONS.find(
      (definition) =>
        normalizeFileName(
          definition.fileName
        ) === normalized
    ) || null
  );
}

function findDefinitionByAlias(
  value
) {
  const normalized =
    normalizeText(
      value
    );

  if (!normalized) {
    return null;
  }

  return (
    BOT_DEFINITIONS.find(
      (definition) => {
        if (
          normalizeText(
            definition.id
          ) === normalized
        ) {
          return true;
        }

        if (
          normalizeText(
            definition.name
          ) === normalized
        ) {
          return true;
        }

        return (
          definition.aliases ||
          []
        ).some(
          (alias) =>
            normalizeText(
              alias
            ) ===
            normalized
        );
      }
    ) || null
  );
}

export function getDBotCatalog() {
  return BOT_DEFINITIONS.map(
    cloneDefinition
  );
}

export function getDBotDefinition(
  idOrName
) {
  return cloneDefinition(
    findDefinitionByAlias(
      idOrName
    ) ||
      findDefinitionByFileName(
        idOrName
      )
  );
}

export function hasDBotDefinition(
  idOrName
) {
  return Boolean(
    findDefinitionByAlias(
      idOrName
    ) ||
      findDefinitionByFileName(
        idOrName
      )
  );
}

export function identifyDBot(
  model,
  fileName = ''
) {
  const byFileName =
    findDefinitionByFileName(
      fileName ||
        model?.source
          ?.fileName
    );

  if (byFileName) {
    return {
      ...cloneDefinition(
        byFileName
      ),

      detectedFamily:
        inferFamilyFromTrade(
          model?.trade
        ),

      registered:
        true,
    };
  }

  const detectedFamily =
    inferFamilyFromTrade(
      model?.trade
    );

  const sourceName =
    model?.source
      ?.fileName ||
    fileName ||
    'Imported D-Bot';

  return {
    id:
      `uploaded:${normalizeText(
        sourceName
      )
        .replace(
          /\.xml$/i,
          ''
        )
        .replace(
          /[^a-z0-9]+/g,
          '-'
        )
        .replace(
          /^-+|-+$/g,
          ''
        )}`,

    name:
      sourceName.replace(
        /\.xml$/i,
        ''
      ),

    fileName:
      sourceName,

    family:
      detectedFamily,

    detectedFamily,

    sourceType:
      DBOT_SOURCE_TYPES
        .UPLOADED,

    description:
      'Imported original D-Bot XML strategy.',

    aliases: [],

    registered:
      false,
  };
}

function createLoadedBot(
  model,
  metadata
) {
  const inspection =
    inspectDBotModel(
      model
    );

  const compatibility =
    model.compatibility || {
      executable: false,
      unsupportedBlocks: [],
    };

  const status =
    compatibility.executable
      ? DBOT_EXECUTION_STATUS
          .READY
      : DBOT_EXECUTION_STATUS
          .UNSUPPORTED;

  return {
    id:
      metadata.id,

    name:
      metadata.name,

    fileName:
      metadata.fileName,

    family:
      metadata.family,

    detectedFamily:
      metadata.detectedFamily ||
      inferFamilyFromTrade(
        model.trade
      ),

    sourceType:
      metadata.sourceType,

    registered:
      Boolean(
        metadata.registered
      ),

    description:
      metadata.description ||
      '',

    status,

    model,

    inspection,

    compatibility,

    trade:
      model.trade,

    risk:
      model.risk,

    createRuntime(
      options = {}
    ) {
      return createDBotRuntime(
        model,
        options
      );
    },

    assertExecutable() {
      return assertDBotExecutable(
        model
      );
    },
  };
}

export function loadDBotXml(
  xmlText,
  options = {}
) {
  const {
    fileName =
      'Imported D-Bot.xml',

    expectedBotId =
      null,
  } = options;

  const model =
    parseDBotXml(
      xmlText,
      {
        fileName,
      }
    );

  const metadata =
    identifyDBot(
      model,
      fileName
    );

  if (
    expectedBotId &&
    metadata.id !==
      expectedBotId
  ) {
    throw new Error(
      `[D-Bot Catalog] Expected "${expectedBotId}" but loaded "${metadata.id}".`
    );
  }

  return createLoadedBot(
    model,
    metadata
  );
}

export async function loadDBotFile(
  file,
  options = {}
) {
  if (!file) {
    throw new Error(
      '[D-Bot Catalog] No XML file was supplied.'
    );
  }

  const model =
    await parseDBotFile(
      file
    );

  const metadata =
    identifyDBot(
      model,
      file.name
    );

  if (
    options.expectedBotId &&
    metadata.id !==
      options.expectedBotId
  ) {
    throw new Error(
      `[D-Bot Catalog] Expected "${options.expectedBotId}" but loaded "${metadata.id}".`
    );
  }

  return createLoadedBot(
    model,
    metadata
  );
}

export function createDBotCatalogEntry(
  loadedBot
) {
  if (
    !loadedBot ||
    !loadedBot.model
  ) {
    throw new Error(
      '[D-Bot Catalog] A loaded D-Bot is required.'
    );
  }

  return {
    id:
      loadedBot.id,

    name:
      loadedBot.name,

    fileName:
      loadedBot.fileName,

    family:
      loadedBot.family,

    detectedFamily:
      loadedBot.detectedFamily,

    sourceType:
      loadedBot.sourceType,

    registered:
      loadedBot.registered,

    description:
      loadedBot.description,

    status:
      loadedBot.status,

    executable:
      Boolean(
        loadedBot
          .compatibility
          ?.executable
      ),

    unsupportedBlocks:
      (
        loadedBot
          .compatibility
          ?.unsupportedBlocks ||
        []
      ).map(
        (item) => ({
          ...item,
        })
      ),

    symbol:
      loadedBot.trade
        ?.symbol ||
      null,

    tradeType:
      loadedBot.trade
        ?.tradeType ||
      null,

    tradeTypeCategory:
      loadedBot.trade
        ?.tradeTypeCategory ||
      null,

    contractSelection:
      loadedBot.trade
        ?.contractSelection ||
      null,

    availableContracts: [
      ...(
        loadedBot.trade
          ?.availableContracts ||
        []
      ),
    ],

    restartOnError:
      loadedBot.trade
        ?.restartOnError ??
      null,

    candleInterval:
      loadedBot.trade
        ?.candleInterval ??
      null,
  };
}

export function validateDBotIdentity(
  loadedBot,
  expected
) {
  if (
    !loadedBot ||
    !loadedBot.model
  ) {
    throw new Error(
      '[D-Bot Catalog] A loaded D-Bot is required.'
    );
  }

  const failures = [];

  if (
    expected?.id &&
    loadedBot.id !==
      expected.id
  ) {
    failures.push(
      `ID expected "${expected.id}", received "${loadedBot.id}".`
    );
  }

  if (
    expected?.family &&
    loadedBot.family !==
      expected.family
  ) {
    failures.push(
      `Family expected "${expected.family}", received "${loadedBot.family}".`
    );
  }

  if (
    expected?.symbol &&
    loadedBot.trade
      ?.symbol !==
      expected.symbol
  ) {
    failures.push(
      `Symbol expected "${expected.symbol}", received "${loadedBot.trade?.symbol}".`
    );
  }

  if (
    expected?.tradeType &&
    loadedBot.trade
      ?.tradeType !==
      expected.tradeType
  ) {
    failures.push(
      `Trade type expected "${expected.tradeType}", received "${loadedBot.trade?.tradeType}".`
    );
  }

  return {
    valid:
      failures.length ===
      0,

    failures,
  };
}

export function createDBotRegistry() {
  const bots =
    new Map();

  function add(
    loadedBot
  ) {
    if (
      !loadedBot ||
      !loadedBot.id
    ) {
      throw new Error(
        '[D-Bot Registry] A valid loaded bot is required.'
      );
    }

    bots.set(
      loadedBot.id,
      loadedBot
    );

    return loadedBot;
  }

  function remove(
    botId
  ) {
    return bots.delete(
      botId
    );
  }

  function get(
    botId
  ) {
    return (
      bots.get(
        botId
      ) || null
    );
  }

  function has(
    botId
  ) {
    return bots.has(
      botId
    );
  }

  function list() {
    return Array.from(
      bots.values()
    ).map(
      createDBotCatalogEntry
    );
  }

  function clear() {
    bots.clear();
  }

  function createRuntime(
    botId,
    options = {}
  ) {
    const bot =
      get(botId);

    if (!bot) {
      throw new Error(
        `[D-Bot Registry] Bot "${botId}" is not loaded.`
      );
    }

    bot.assertExecutable();

    return bot.createRuntime(
      options
    );
  }

  return {
    add,
    remove,
    get,
    has,
    list,
    clear,
    createRuntime,

    get size() {
      return bots.size;
    },
  };
}

export function getDBotFamilyLabel(
  family
) {
  switch (family) {
    case DBOT_FAMILIES
      .EVEN_ODD:
      return 'Even / Odd';

    case DBOT_FAMILIES
      .OVER_UNDER:
      return 'Over / Under';

    case DBOT_FAMILIES
      .MATCHES_DIFFERS:
      return 'Matches / Differs';

    case DBOT_FAMILIES
      .RISE_FALL:
      return 'Rise / Fall';

    case DBOT_FAMILIES
      .ACCUMULATOR:
      return 'Accumulator';

    default:
      return 'D-Bot';
  }
}

export function getDBotStatusLabel(
  status
) {
  switch (status) {
    case DBOT_EXECUTION_STATUS
      .READY:
      return 'Ready';

    case DBOT_EXECUTION_STATUS
      .LOADED:
      return 'Loaded';

    case DBOT_EXECUTION_STATUS
      .UNSUPPORTED:
      return 'Needs engine support';

    case DBOT_EXECUTION_STATUS
      .INVALID:
      return 'Invalid XML';

    default:
      return 'Not loaded';
  }
}

export default {
  getCatalog:
    getDBotCatalog,

  getDefinition:
    getDBotDefinition,

  identify:
    identifyDBot,

  loadXml:
    loadDBotXml,

  loadFile:
    loadDBotFile,

  createRegistry:
    createDBotRegistry,

  getFamilyLabel:
    getDBotFamilyLabel,

  getStatusLabel:
    getDBotStatusLabel,
};
