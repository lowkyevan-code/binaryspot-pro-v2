/*
 * BinarySpot Pro
 * D-Bot XML Engine
 *
 * File:
 *   lib/dbotXmlEngine.js
 *
 * Purpose:
 *   Parse Deriv / DBot Blockly XML into a deterministic runtime model
 *   without rewriting, approximating, or silently changing the bot.
 *
 * IMPORTANT:
 *   This engine is intentionally strict.
 *
 *   If an XML bot contains a block whose runtime semantics have not been
 *   implemented, the engine reports that block as unsupported instead of
 *   guessing what it should do.
 *
 *   This lets BinarySpot progressively support the exact uploaded bots
 *   while preserving their original logic.
 */

const DBOT_ENGINE_VERSION = '1.0.0';

const ROOT_BLOCK_TYPES = new Set([
  'trade',
  'trade_definition',
  'before_purchase',
  'during_purchase',
  'after_purchase',
  'procedures_defnoreturn',
  'procedures_defreturn',
]);

const VALUE_BLOCK_TYPES = new Set([
  'math_number',
  'math_number_positive',
  'text',
  'logic_boolean',
  'logic_null',
  'variables_get',
  'math_arithmetic',
  'math_single',
  'math_round',
  'math_number_property',
  'math_random_int',
  'logic_compare',
  'logic_operation',
  'logic_ternary',
  'text_join',
  'text_length',
  'last_digit',
  'lastDigitList',
  'lists_getIndex',
  'lists_getSublist',
  'lists_indexOf',
  'lists_sort',
  'total_profit',
  'total_runs',
  'tick',
  'tick_analysis',
  'read_details',
  'contract_check_result',
  'stat',
  'ohlc',
  'ohlc_values_in_list',
  'period',
  'check_sell',
  'procedures_callreturn',
]);

const STATEMENT_BLOCK_TYPES = new Set([
  'variables_set',
  'variable_sets',
  'math_change',
  'controls_if',
  'text_print',
  'text_statement',
  'notify',
  'btnotify',
  'purchase',
  'apollo_purchase',
  'purchase_universal',
  'ph_exec_buy',
  'trade_again',
  'timeout',
  'sell_at_market',
  'procedures_callnoreturn',
  'ph_notify_pro',
  'custom_prediction_setter_v2',
]);

const CONFIG_BLOCK_TYPES = new Set([
  'trade_definition_market',
  'trade_definition_tradetype',
  'trade_definition_contracttype',
  'trade_definition_candleinterval',
  'trade_definition_restartbuysell',
  'trade_definition_restartonerror',
  'trade_definition_tradeoptions',
  'trade_definition_accumulator',
  'tradeOptions',
  'riskmanagment_settings',
  'enable_martingale',
  'use_split_martingale',
  'martingale',
  'take_profit',
  'stop_loss',
  'max_split',
  'accumulator_take_profit',
]);

const ANALYSIS_BLOCK_TYPES = new Set([
  'digit_frequency_analysis_v2',
  'last_digits_condition_v2',
  'input_list',
  'rsi_statement',
  'sma_statement',
]);

const KNOWN_BLOCK_TYPES = new Set([
  ...ROOT_BLOCK_TYPES,
  ...VALUE_BLOCK_TYPES,
  ...STATEMENT_BLOCK_TYPES,
  ...CONFIG_BLOCK_TYPES,
  ...ANALYSIS_BLOCK_TYPES,
]);

const CONTRACT_TYPE_MAP = Object.freeze({
  DIGITEVEN: 'DIGITEVEN',
  DIGITODD: 'DIGITODD',
  DIGITOVER: 'DIGITOVER',
  DIGITUNDER: 'DIGITUNDER',
  DIGITMATCH: 'DIGITMATCH',
  DIGITDIFF: 'DIGITDIFF',
  CALL: 'CALL',
  PUT: 'PUT',
  ACCU: 'ACCU',
});

const TRADE_TYPE_MAP = Object.freeze({
  evenodd: {
    category: 'digits',
    contracts: ['DIGITEVEN', 'DIGITODD'],
  },

  overunder: {
    category: 'digits',
    contracts: ['DIGITOVER', 'DIGITUNDER'],
  },

  matchesdiffers: {
    category: 'digits',
    contracts: ['DIGITMATCH', 'DIGITDIFF'],
  },

  callput: {
    category: 'callput',
    contracts: ['CALL', 'PUT'],
  },

  accumulator: {
    category: 'accumulator',
    contracts: ['ACCU'],
  },
});

function invariant(condition, message) {
  if (!condition) {
    throw new Error(
      `[DBot XML Engine] ${message}`
    );
  }
}

function isBrowser() {
  return (
    typeof window !== 'undefined' &&
    typeof window.DOMParser !== 'undefined'
  );
}

function normalizeString(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value).trim();
}

function normalizeNumber(
  value,
  fallback = null
) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function normalizeBoolean(
  value,
  fallback = false
) {
  if (
    typeof value === 'boolean'
  ) {
    return value;
  }

  const normalized =
    normalizeString(value)
      .toLowerCase();

  if (
    normalized === 'true' ||
    normalized === '1'
  ) {
    return true;
  }

  if (
    normalized === 'false' ||
    normalized === '0'
  ) {
    return false;
  }

  return fallback;
}

function elementChildren(
  element,
  tagName = null
) {
  if (!element) {
    return [];
  }

  return Array.from(
    element.children || []
  ).filter((child) => {
    if (!tagName) {
      return true;
    }

    return (
      child.tagName
        ?.toLowerCase() ===
      tagName.toLowerCase()
    );
  });
}

function firstElementChild(
  element,
  tagNames = []
) {
  const names = new Set(
    tagNames.map((name) =>
      name.toLowerCase()
    )
  );

  return (
    elementChildren(element).find(
      (child) =>
        names.has(
          child.tagName
            ?.toLowerCase()
        )
    ) || null
  );
}

function getDirectChild(
  element,
  tagName
) {
  return (
    elementChildren(
      element,
      tagName
    )[0] || null
  );
}

function getFieldMap(
  blockElement
) {
  const fields = {};

  for (
    const field of
    elementChildren(
      blockElement,
      'field'
    )
  ) {
    const name =
      field.getAttribute(
        'name'
      );

    if (!name) {
      continue;
    }

    fields[name] =
      normalizeString(
        field.textContent
      );
  }

  return fields;
}

function getMutationMap(
  blockElement
) {
  const mutation =
    getDirectChild(
      blockElement,
      'mutation'
    );

  if (!mutation) {
    return {};
  }

  const attributes = {};

  for (
    const attribute of
    Array.from(
      mutation.attributes || []
    )
  ) {
    attributes[
      attribute.name
    ] = attribute.value;
  }

  return attributes;
}

function parseValueContainer(
  container
) {
  if (!container) {
    return null;
  }

  const realBlock =
    firstElementChild(
      container,
      ['block']
    );

  const shadowBlock =
    firstElementChild(
      container,
      ['shadow']
    );

  const selected =
    realBlock ||
    shadowBlock;

  if (!selected) {
    return null;
  }

  return parseBlock(
    selected,
    selected.tagName
      ?.toLowerCase() ===
      'shadow'
  );
}

function parseValues(
  blockElement
) {
  const values = {};

  for (
    const valueElement of
    elementChildren(
      blockElement,
      'value'
    )
  ) {
    const name =
      valueElement.getAttribute(
        'name'
      );

    if (!name) {
      continue;
    }

    values[name] =
      parseValueContainer(
        valueElement
      );
  }

  return values;
}

function parseStatements(
  blockElement
) {
  const statements = {};

  for (
    const statementElement of
    elementChildren(
      blockElement,
      'statement'
    )
  ) {
    const name =
      statementElement.getAttribute(
        'name'
      );

    if (!name) {
      continue;
    }

    const firstBlock =
      firstElementChild(
        statementElement,
        ['block', 'shadow']
      );

    statements[name] =
      firstBlock
        ? parseBlock(
            firstBlock,
            firstBlock.tagName
              ?.toLowerCase() ===
              'shadow'
          )
        : null;
  }

  return statements;
}

function parseNext(
  blockElement
) {
  const nextElement =
    getDirectChild(
      blockElement,
      'next'
    );

  if (!nextElement) {
    return null;
  }

  const nextBlock =
    firstElementChild(
      nextElement,
      ['block', 'shadow']
    );

  if (!nextBlock) {
    return null;
  }

  return parseBlock(
    nextBlock,
    nextBlock.tagName
      ?.toLowerCase() ===
      'shadow'
  );
}

function parseBlock(
  blockElement,
  shadow = false
) {
  invariant(
    blockElement,
    'Cannot parse an empty block.'
  );

  const type =
    normalizeString(
      blockElement.getAttribute(
        'type'
      )
    );

  const id =
    normalizeString(
      blockElement.getAttribute(
        'id'
      )
    );

  invariant(
    type,
    'A Blockly block is missing its type.'
  );

  return {
    id:
      id ||
      `anonymous:${type}`,
    type,
    shadow,
    fields:
      getFieldMap(
        blockElement
      ),
    mutation:
      getMutationMap(
        blockElement
      ),
    values:
      parseValues(
        blockElement
      ),
    statements:
      parseStatements(
        blockElement
      ),
    next:
      parseNext(
        blockElement
      ),
  };
}

function parseVariables(
  root
) {
  const variables = {};

  const variablesElement =
    getDirectChild(
      root,
      'variables'
    );

  if (!variablesElement) {
    return variables;
  }

  for (
    const variableElement of
    elementChildren(
      variablesElement,
      'variable'
    )
  ) {
    const id =
      normalizeString(
        variableElement.getAttribute(
          'id'
        )
      );

    if (!id) {
      continue;
    }

    variables[id] = {
      id,
      name:
        normalizeString(
          variableElement.textContent
        ),
      type:
        normalizeString(
          variableElement.getAttribute(
            'type'
          )
        ),
      isLocal:
        normalizeBoolean(
          variableElement.getAttribute(
            'islocal'
          ),
          false
        ),
      isCloud:
        normalizeBoolean(
          variableElement.getAttribute(
            'iscloud'
          ),
          false
        ),
    };
  }

  return variables;
}

function walkBlock(
  block,
  callback,
  visited = new Set()
) {
  if (!block) {
    return;
  }

  const visitKey =
    `${block.id}:${block.type}`;

  if (
    visited.has(
      visitKey
    )
  ) {
    return;
  }

  visited.add(
    visitKey
  );

  callback(block);

  for (
    const valueBlock of
    Object.values(
      block.values || {}
    )
  ) {
    walkBlock(
      valueBlock,
      callback,
      visited
    );
  }

  for (
    const statementBlock of
    Object.values(
      block.statements || {}
    )
  ) {
    walkBlock(
      statementBlock,
      callback,
      visited
    );
  }

  walkBlock(
    block.next,
    callback,
    visited
  );
}

function collectBlocks(
  roots
) {
  const blocks = [];

  for (
    const root of roots
  ) {
    walkBlock(
      root,
      (block) => {
        blocks.push(block);
      }
    );
  }

  return blocks;
}

function findFirstBlock(
  model,
  type
) {
  return (
    model.blocks.find(
      (block) =>
        block.type === type
    ) || null
  );
}

function findBlocks(
  model,
  type
) {
  return model.blocks.filter(
    (block) =>
      block.type === type
  );
}

function getVariableId(
  block
) {
  if (!block) {
    return '';
  }

  return (
    block.fields?.VAR ||
    ''
  );
}

function resolveVariableName(
  model,
  variableId
) {
  return (
    model.variables[
      variableId
    ]?.name ||
    variableId
  );
}

function getTradeConfiguration(
  model
) {
  const market =
    findFirstBlock(
      model,
      'trade_definition_market'
    );

  const tradeType =
    findFirstBlock(
      model,
      'trade_definition_tradetype'
    );

  const contractType =
    findFirstBlock(
      model,
      'trade_definition_contracttype'
    );

  const candleInterval =
    findFirstBlock(
      model,
      'trade_definition_candleinterval'
    );

  const restartOnError =
    findFirstBlock(
      model,
      'trade_definition_restartonerror'
    );

  const restartBuySell =
    findFirstBlock(
      model,
      'trade_definition_restartbuysell'
    );

  const tradeOptions =
    findFirstBlock(
      model,
      'trade_definition_tradeoptions'
    );

  const accumulator =
    findFirstBlock(
      model,
      'trade_definition_accumulator'
    );

  const tradeTypeName =
    tradeType?.fields
      ?.TRADETYPE_LIST ||
    '';

  const mappedTradeType =
    TRADE_TYPE_MAP[
      tradeTypeName
    ] || null;

  return {
    market:
      market?.fields
        ?.MARKET_LIST ||
      null,

    submarket:
      market?.fields
        ?.SUBMARKET_LIST ||
      null,

    symbol:
      market?.fields
        ?.SYMBOL_LIST ||
      null,

    tradeTypeCategory:
      tradeType?.fields
        ?.TRADETYPECAT_LIST ||
      null,

    tradeType:
      tradeTypeName ||
      null,

    contractSelection:
      contractType?.fields
        ?.TYPE_LIST ||
      null,

    availableContracts:
      mappedTradeType
        ?.contracts || [],

    candleInterval:
      normalizeNumber(
        candleInterval?.fields
          ?.CANDLEINTERVAL_LIST,
        null
      ),

    restartOnError:
      normalizeBoolean(
        restartOnError?.fields
          ?.RESTARTONERROR,
        false
      ),

    timeMachineEnabled:
      normalizeBoolean(
        restartBuySell?.fields
          ?.TIME_MACHINE_ENABLED,
        false
      ),

    durationType:
      tradeOptions?.fields
        ?.DURATIONTYPE_LIST ||
      null,

    tradeOptionsBlock:
      tradeOptions,

    accumulatorBlock:
      accumulator,
  };
}

function getRiskConfiguration(
  model
) {
  const martingaleBlock =
    findFirstBlock(
      model,
      'martingale'
    );

  const enableMartingale =
    findFirstBlock(
      model,
      'enable_martingale'
    );

  const splitMartingale =
    findFirstBlock(
      model,
      'use_split_martingale'
    );

  const takeProfit =
    findFirstBlock(
      model,
      'take_profit'
    );

  const stopLoss =
    findFirstBlock(
      model,
      'stop_loss'
    );

  const maxSplit =
    findFirstBlock(
      model,
      'max_split'
    );

  return {
    enabled:
      enableMartingale
        ? normalizeBoolean(
            enableMartingale
              .fields
              ?.ENABLE_MARTINGALE,
            false
          )
        : null,

    splitEnabled:
      splitMartingale
        ? normalizeBoolean(
            splitMartingale
              .fields
              ?.USE_SPLIT_MARTINGALE,
            false
          )
        : null,

    martingaleBlock,
    takeProfitBlock:
      takeProfit,
    stopLossBlock:
      stopLoss,
    maxSplitBlock:
      maxSplit,
  };
}

function buildCompatibilityReport(
  model
) {
  const unsupported =
    [];

  const known = [];

  for (
    const block of
    model.blocks
  ) {
    if (
      KNOWN_BLOCK_TYPES.has(
        block.type
      )
    ) {
      known.push(
        block.type
      );
    } else {
      unsupported.push({
        id: block.id,
        type: block.type,
      });
    }
  }

  const uniqueKnown =
    Array.from(
      new Set(known)
    ).sort();

  const uniqueUnsupported =
    Array.from(
      new Map(
        unsupported.map(
          (item) => [
            item.type,
            item,
          ]
        )
      ).values()
    ).sort(
      (a, b) =>
        a.type.localeCompare(
          b.type
        )
    );

  return {
    exactParse:
      true,

    executable:
      uniqueUnsupported
        .length === 0,

    knownBlockTypes:
      uniqueKnown,

    unsupportedBlocks:
      uniqueUnsupported,

    totalBlocks:
      model.blocks.length,

    supportedBlocks:
      model.blocks.filter(
        (block) =>
          KNOWN_BLOCK_TYPES.has(
            block.type
          )
      ).length,
  };
}

function parseXmlDocument(
  xmlText
) {
  invariant(
    isBrowser(),
    'DOMParser is unavailable. Parse D-Bot XML from the browser/client runtime.'
  );

  invariant(
    typeof xmlText ===
      'string' &&
      xmlText.trim(),
    'XML source is empty.'
  );

  const parser =
    new window.DOMParser();

  const document =
    parser.parseFromString(
      xmlText,
      'application/xml'
    );

  const parserError =
    document.querySelector(
      'parsererror'
    );

  if (parserError) {
    throw new Error(
      `[DBot XML Engine] Invalid XML: ${
        parserError.textContent ||
        'XML parsing failed.'
      }`
    );
  }

  const root =
    document.documentElement;

  invariant(
    root &&
      root.tagName
        ?.toLowerCase() ===
        'xml',
    'The supplied file is not a D-Bot Blockly XML document.'
  );

  return {
    document,
    root,
  };
}

export function parseDBotXml(
  xmlText,
  options = {}
) {
  const {
    fileName =
      'Imported D-Bot',
  } = options;

  const {
    root,
  } =
    parseXmlDocument(
      xmlText
    );

  const variables =
    parseVariables(root);

  const roots =
    elementChildren(
      root,
      'block'
    ).map(
      (element) =>
        parseBlock(
          element,
          false
        )
    );

  invariant(
    roots.length > 0,
    'No Blockly blocks were found in this XML file.'
  );

  const blocks =
    collectBlocks(
      roots
    );

  const model = {
    engineVersion:
      DBOT_ENGINE_VERSION,

    source: {
      fileName,
      isDBot:
        normalizeBoolean(
          root.getAttribute(
            'is_dbot'
          ),
          false
        ),
      collection:
        normalizeBoolean(
          root.getAttribute(
            'collection'
          ),
          false
        ),
    },

    variables,
    roots,
    blocks,
  };

  model.trade =
    getTradeConfiguration(
      model
    );

  model.risk =
    getRiskConfiguration(
      model
    );

  model.compatibility =
    buildCompatibilityReport(
      model
    );

  return model;
}

export async function parseDBotFile(
  file
) {
  invariant(
    file &&
      typeof file.text ===
        'function',
    'A valid XML File object is required.'
  );

  const xmlText =
    await file.text();

  return parseDBotXml(
    xmlText,
    {
      fileName:
        file.name ||
        'Imported D-Bot.xml',
    }
  );
}

function getRuntimeVariable(
  runtime,
  variableId
) {
  if (
    Object.prototype.hasOwnProperty.call(
      runtime.variables,
      variableId
    )
  ) {
    return runtime.variables[
      variableId
    ];
  }

  return null;
}

function setRuntimeVariable(
  runtime,
  variableId,
  value
) {
  runtime.variables[
    variableId
  ] = value;

  return value;
}

function getField(
  block,
  name,
  fallback = ''
) {
  return (
    block?.fields?.[
      name
    ] ??
    fallback
  );
}

function evaluateArithmetic(
  operator,
  left,
  right
) {
  const a =
    Number(left);

  const b =
    Number(right);

  switch (operator) {
    case 'ADD':
      return a + b;

    case 'MINUS':
      return a - b;

    case 'MULTIPLY':
      return a * b;

    case 'DIVIDE':
      return b === 0
        ? Infinity
        : a / b;

    case 'POWER':
      return Math.pow(
        a,
        b
      );

    default:
      throw new Error(
        `[DBot XML Engine] Unsupported arithmetic operator: ${operator}`
      );
  }
}

function evaluateComparison(
  operator,
  left,
  right
) {
  switch (operator) {
    case 'EQ':
      return left == right;

    case 'NEQ':
      return left != right;

    case 'LT':
      return (
        Number(left) <
        Number(right)
      );

    case 'LTE':
      return (
        Number(left) <=
        Number(right)
      );

    case 'GT':
      return (
        Number(left) >
        Number(right)
      );

    case 'GTE':
      return (
        Number(left) >=
        Number(right)
      );

    default:
      throw new Error(
        `[DBot XML Engine] Unsupported comparison operator: ${operator}`
      );
  }
}

function evaluateMathSingle(
  operator,
  value
) {
  const number =
    Number(value);

  switch (operator) {
    case 'ROOT':
      return Math.sqrt(
        number
      );

    case 'ABS':
      return Math.abs(
        number
      );

    case 'NEG':
      return -number;

    case 'LN':
      return Math.log(
        number
      );

    case 'LOG10':
      return Math.log10(
        number
      );

    case 'EXP':
      return Math.exp(
        number
      );

    case 'POW10':
      return Math.pow(
        10,
        number
      );

    case 'ROUND':
      return Math.round(
        number
      );

    case 'ROUNDUP':
      return Math.ceil(
        number
      );

    case 'ROUNDDOWN':
      return Math.floor(
        number
      );

    default:
      throw new Error(
        `[DBot XML Engine] Unsupported math operator: ${operator}`
      );
  }
}

function evaluateValue(
  block,
  runtime
) {
  if (!block) {
    return null;
  }

  switch (block.type) {
    case 'math_number':
    case 'math_number_positive':
      return normalizeNumber(
        getField(
          block,
          'NUM'
        ),
        0
      );

    case 'text':
      return getField(
        block,
        'TEXT',
        ''
      );

    case 'logic_boolean':
      return normalizeBoolean(
        getField(
          block,
          'BOOL'
        ),
        false
      );

    case 'logic_null':
      return null;

    case 'variables_get':
      return getRuntimeVariable(
        runtime,
        getVariableId(
          block
        )
      );

    case 'math_arithmetic':
      return evaluateArithmetic(
        getField(
          block,
          'OP'
        ),
        evaluateValue(
          block.values?.A,
          runtime
        ),
        evaluateValue(
          block.values?.B,
          runtime
        )
      );

    case 'math_single':
      return evaluateMathSingle(
        getField(
          block,
          'OP'
        ),
        evaluateValue(
          block.values?.NUM,
          runtime
        )
      );

    case 'math_round':
      return evaluateMathSingle(
        getField(
          block,
          'OP'
        ),
        evaluateValue(
          block.values?.NUM,
          runtime
        )
      );

    case 'math_random_int': {
      const from =
        Math.ceil(
          Number(
            evaluateValue(
              block.values?.FROM,
              runtime
            )
          )
        );

      const to =
        Math.floor(
          Number(
            evaluateValue(
              block.values?.TO,
              runtime
            )
          )
        );

      const low =
        Math.min(
          from,
          to
        );

      const high =
        Math.max(
          from,
          to
        );

      return (
        Math.floor(
          Math.random() *
            (
              high -
              low +
              1
            )
        ) + low
      );
    }

    case 'logic_compare':
      return evaluateComparison(
        getField(
          block,
          'OP'
        ),
        evaluateValue(
          block.values?.A,
          runtime
        ),
        evaluateValue(
          block.values?.B,
          runtime
        )
      );

    case 'logic_operation': {
      const operator =
        getField(
          block,
          'OP'
        );

      if (
        operator === 'AND'
      ) {
        return Boolean(
          evaluateValue(
            block.values?.A,
            runtime
          )
        ) &&
          Boolean(
            evaluateValue(
              block.values?.B,
              runtime
            )
          );
      }

      if (
        operator === 'OR'
      ) {
        return Boolean(
          evaluateValue(
            block.values?.A,
            runtime
          )
        ) ||
          Boolean(
            evaluateValue(
              block.values?.B,
              runtime
            )
          );
      }

      throw new Error(
        `[DBot XML Engine] Unsupported logic operator: ${operator}`
      );
    }

    case 'logic_ternary':
      return Boolean(
        evaluateValue(
          block.values?.IF,
          runtime
        )
      )
        ? evaluateValue(
            block.values?.THEN,
            runtime
          )
        : evaluateValue(
            block.values?.ELSE,
            runtime
          );

    case 'last_digit':
      return runtime.market
        .lastDigit;

    case 'lastDigitList':
      return [
        ...runtime.market
          .lastDigits,
      ];

    case 'total_profit':
      return runtime.trade
        .totalProfit;

    case 'total_runs':
      return runtime.trade
        .totalRuns;

    case 'contract_check_result': {
      const check =
        getField(
          block,
          'CHECK_RESULT'
        );

      switch (check) {
        case 'win':
          return (
            runtime.contract
              .result ===
            'win'
          );

        case 'loss':
          return (
            runtime.contract
              .result ===
            'loss'
          );

        default:
          return false;
      }
    }

    case 'read_details': {
      const detail =
        getField(
          block,
          'DETAIL_INDEX'
        ) ||
        getField(
          block,
          'DETAILS'
        );

      return runtime.contract
        .details?.[
          detail
        ];
    }

    default:
      throw new Error(
        `[DBot XML Engine] Value block "${block.type}" has not yet been given exact runtime semantics.`
      );
  }
}

function executeIf(
  block,
  runtime,
  effects
) {
  let branchIndex = 0;

  while (
    Object.prototype.hasOwnProperty.call(
      block.values,
      `IF${branchIndex}`
    )
  ) {
    const condition =
      evaluateValue(
        block.values[
          `IF${branchIndex}`
        ],
        runtime
      );

    if (condition) {
      executeChain(
        block.statements[
          `DO${branchIndex}`
        ],
        runtime,
        effects
      );

      return;
    }

    branchIndex += 1;
  }

  if (
    block.statements?.ELSE
  ) {
    executeChain(
      block.statements.ELSE,
      runtime,
      effects
    );
  }
}

function executeStatement(
  block,
  runtime,
  effects
) {
  if (!block) {
    return;
  }

  switch (block.type) {
    case 'variables_set':
    case 'variable_sets': {
      const variableId =
        getVariableId(
          block
        );

      const value =
        evaluateValue(
          block.values?.VALUE,
          runtime
        );

      setRuntimeVariable(
        runtime,
        variableId,
        value
      );

      effects.push({
        type:
          'VARIABLE_SET',
        variableId,
        variableName:
          resolveVariableName(
            runtime.model,
            variableId
          ),
        value,
      });

      return;
    }

    case 'math_change': {
      const variableId =
        getVariableId(
          block
        );

      const current =
        Number(
          getRuntimeVariable(
            runtime,
            variableId
          ) || 0
        );

      const delta =
        Number(
          evaluateValue(
            block.values?.DELTA,
            runtime
          ) || 0
        );

      const value =
        current + delta;

      setRuntimeVariable(
        runtime,
        variableId,
        value
      );

      effects.push({
        type:
          'VARIABLE_CHANGE',
        variableId,
        variableName:
          resolveVariableName(
            runtime.model,
            variableId
          ),
        delta,
        value,
      });

      return;
    }

    case 'controls_if':
      executeIf(
        block,
        runtime,
        effects
      );
      return;

    case 'trade_again':
      effects.push({
        type:
          'TRADE_AGAIN',
      });
      return;

    case 'purchase':
    case 'apollo_purchase':
    case 'purchase_universal':
    case 'ph_exec_buy':
      effects.push({
        type:
          'PURCHASE',
        sourceBlockType:
          block.type,
        contractType:
          getField(
            block,
            'PURCHASE_LIST'
          ) ||
          getField(
            block,
            'CONTRACT_TYPE'
          ) ||
          null,
        fields: {
          ...block.fields,
        },
      });
      return;

    case 'notify':
    case 'btnotify':
    case 'ph_notify_pro':
    case 'text_print':
    case 'text_statement':
      effects.push({
        type:
          'MESSAGE',
        sourceBlockType:
          block.type,
        fields: {
          ...block.fields,
        },
      });
      return;

    case 'timeout':
      effects.push({
        type:
          'TIMEOUT',
        duration:
          evaluateValue(
            block.values
              ?.SECONDS ||
              block.values
                ?.DURATION,
            runtime
          ),
      });
      return;

    case 'sell_at_market':
      effects.push({
        type:
          'SELL_AT_MARKET',
      });
      return;

    case 'procedures_callnoreturn':
      effects.push({
        type:
          'PROCEDURE_CALL',
        procedure:
          getField(
            block,
            'NAME'
          ),
      });
      return;

    case 'custom_prediction_setter_v2':
      effects.push({
        type:
          'CUSTOM_PREDICTION',
        block,
      });
      return;

    default:
      throw new Error(
        `[DBot XML Engine] Statement block "${block.type}" has not yet been given exact runtime semantics.`
      );
  }
}

function executeChain(
  firstBlock,
  runtime,
  effects = []
) {
  let block =
    firstBlock;

  const visited =
    new Set();

  while (block) {
    const key =
      `${block.id}:${block.type}`;

    invariant(
      !visited.has(key),
      `Circular Blockly chain detected at ${block.type}.`
    );

    visited.add(key);

    executeStatement(
      block,
      runtime,
      effects
    );

    block =
      block.next;
  }

  return effects;
}

function createInitialVariableState(
  model
) {
  const state = {};

  for (
    const variableId of
    Object.keys(
      model.variables
    )
  ) {
    state[
      variableId
    ] = null;
  }

  return state;
}

function findRoot(
  model,
  type
) {
  return (
    model.roots.find(
      (root) =>
        root.type === type
    ) || null
  );
}

function findStatement(
  block,
  names
) {
  if (!block) {
    return null;
  }

  for (
    const name of names
  ) {
    if (
      block.statements?.[
        name
      ]
    ) {
      return block
        .statements[name];
    }
  }

  return null;
}

function executeInitialization(
  runtime
) {
  const tradeDefinition =
    findRoot(
      runtime.model,
      'trade_definition'
    );

  if (!tradeDefinition) {
    return [];
  }

  const initialization =
    findStatement(
      tradeDefinition,
      [
        'INITIALIZATION',
      ]
    );

  if (
    !initialization
  ) {
    return [];
  }

  return executeChain(
    initialization,
    runtime,
    []
  );
}

export function createDBotRuntime(
  model,
  options = {}
) {
  invariant(
    model &&
      Array.isArray(
        model.blocks
      ),
    'A parsed D-Bot model is required.'
  );

  const runtime = {
    engineVersion:
      DBOT_ENGINE_VERSION,

    model,

    variables:
      createInitialVariableState(
        model
      ),

    market: {
      symbol:
        model.trade
          ?.symbol ||
        null,

      quote: null,
      lastDigit: null,
      lastDigits: [],
      ticks: [],
    },

    trade: {
      totalProfit: 0,
      totalRuns: 0,
      wins: 0,
      losses: 0,
    },

    contract: {
      id: null,
      result: null,
      profit: 0,
      details: {},
    },

    status:
      'CREATED',

    strict:
      options.strict !==
      false,

    events: [],
  };

  runtime.initialize =
    () => {
      const effects =
        executeInitialization(
          runtime
        );

      runtime.status =
        'INITIALIZED';

      runtime.events.push({
        type:
          'INITIALIZED',
        at:
          Date.now(),
        effects,
      });

      return effects;
    };

  runtime.pushTick =
    ({
      quote,
      epoch = null,
      pipSize = null,
    }) => {
      const numericQuote =
        Number(quote);

      invariant(
        Number.isFinite(
          numericQuote
        ),
        'pushTick requires a valid quote.'
      );

      const decimals =
        Number.isFinite(
          Number(pipSize)
        )
          ? Number(
              pipSize
            )
          : null;

      const quoteString =
        decimals !== null
          ? numericQuote.toFixed(
              decimals
            )
          : String(
              numericQuote
            );

      const lastCharacter =
        quoteString
          .replace(
            /[^0-9]/g,
            ''
          )
          .slice(-1);

      const lastDigit =
        normalizeNumber(
          lastCharacter,
          null
        );

      const tick = {
        quote:
          numericQuote,
        epoch:
          epoch ||
          Math.floor(
            Date.now() /
              1000
          ),
        pipSize:
          decimals,
        lastDigit,
      };

      runtime.market.quote =
        numericQuote;

      runtime.market.lastDigit =
        lastDigit;

      runtime.market.ticks.push(
        tick
      );

      runtime.market.lastDigits.push(
        lastDigit
      );

      if (
        runtime.market.ticks
          .length > 1000
      ) {
        runtime.market.ticks =
          runtime.market.ticks.slice(
            -1000
          );
      }

      if (
        runtime.market
          .lastDigits.length >
        1000
      ) {
        runtime.market.lastDigits =
          runtime.market.lastDigits.slice(
            -1000
          );
      }

      return tick;
    };

  runtime.beforePurchase =
    () => {
      const root =
        findRoot(
          model,
          'before_purchase'
        );

      if (!root) {
        return [];
      }

      const statement =
        findStatement(
          root,
          [
            'BEFOREPURCHASE_STACK',
            'BEFORE_PURCHASE',
          ]
        );

      if (!statement) {
        return [];
      }

      const effects =
        executeChain(
          statement,
          runtime,
          []
        );

      runtime.events.push({
        type:
          'BEFORE_PURCHASE',
        at:
          Date.now(),
        effects,
      });

      return effects;
    };

  runtime.afterPurchase =
    (contract = {}) => {
      runtime.contract.id =
        contract.id ??
        contract.contractId ??
        null;

      runtime.contract.profit =
        Number(
          contract.profit ||
          0
        );

      runtime.contract.result =
        contract.result ||
        (
          runtime.contract
            .profit > 0
            ? 'win'
            : runtime.contract
                  .profit < 0
              ? 'loss'
              : null
        );

      runtime.contract.details = {
        ...contract,
      };

      runtime.trade.totalRuns +=
        1;

      runtime.trade.totalProfit +=
        runtime.contract.profit;

      if (
        runtime.contract
          .result === 'win'
      ) {
        runtime.trade.wins +=
          1;
      }

      if (
        runtime.contract
          .result === 'loss'
      ) {
        runtime.trade.losses +=
          1;
      }

      const root =
        findRoot(
          model,
          'after_purchase'
        );

      if (!root) {
        return [];
      }

      const statement =
        findStatement(
          root,
          [
            'AFTERPURCHASE_STACK',
            'AFTER_PURCHASE',
          ]
        );

      if (!statement) {
        return [];
      }

      const effects =
        executeChain(
          statement,
          runtime,
          []
        );

      runtime.events.push({
        type:
          'AFTER_PURCHASE',
        at:
          Date.now(),
        result:
          runtime.contract
            .result,
        profit:
          runtime.contract
            .profit,
        effects,
      });

      return effects;
    };

  runtime.snapshot =
    () => ({
      status:
        runtime.status,

      source:
        model.source,

      tradeConfig:
        model.trade,

      riskConfig:
        model.risk,

      compatibility:
        model.compatibility,

      variables: {
        ...runtime.variables,
      },

      market: {
        symbol:
          runtime.market
            .symbol,
        quote:
          runtime.market
            .quote,
        lastDigit:
          runtime.market
            .lastDigit,
        lastDigits:
          [
            ...runtime.market
              .lastDigits,
          ],
      },

      trade: {
        ...runtime.trade,
      },

      contract: {
        ...runtime.contract,
      },
    });

  return runtime;
}

export function inspectDBotModel(
  model
) {
  invariant(
    model,
    'A parsed D-Bot model is required.'
  );

  const blockTypeCounts =
    {};

  for (
    const block of
    model.blocks
  ) {
    blockTypeCounts[
      block.type
    ] =
      (
        blockTypeCounts[
          block.type
        ] || 0
      ) + 1;
  }

  return {
    fileName:
      model.source
        ?.fileName ||
      null,

    isDBot:
      model.source
        ?.isDBot ||
      false,

    trade: {
      ...model.trade,
    },

    compatibility: {
      ...model.compatibility,
    },

    variableCount:
      Object.keys(
        model.variables
      ).length,

    blockCount:
      model.blocks.length,

    blockTypeCounts,

    rootBlocks:
      model.roots.map(
        (block) => ({
          id: block.id,
          type: block.type,
        })
      ),
  };
}

export function assertDBotExecutable(
  model
) {
  invariant(
    model,
    'A parsed D-Bot model is required.'
  );

  const unsupported =
    model.compatibility
      ?.unsupportedBlocks ||
    [];

  if (
    unsupported.length
  ) {
    const names =
      unsupported
        .map(
          (item) =>
            item.type
        )
        .join(', ');

    throw new Error(
      `[DBot XML Engine] Exact execution is blocked because this bot contains unsupported blocks: ${names}`
    );
  }

  return true;
}

export function getDBotVariableByName(
  model,
  runtime,
  name
) {
  const entry =
    Object.values(
      model.variables
    ).find(
      (variable) =>
        variable.name ===
        name
    );

  if (!entry) {
    return undefined;
  }

  return runtime.variables[
    entry.id
  ];
}

export function setDBotVariableByName(
  model,
  runtime,
  name,
  value
) {
  const entry =
    Object.values(
      model.variables
    ).find(
      (variable) =>
        variable.name ===
        name
    );

  invariant(
    entry,
    `Variable "${name}" does not exist in this D-Bot.`
  );

  runtime.variables[
    entry.id
  ] = value;

  return value;
}

export function getDBotSupportedBlockTypes() {
  return Array.from(
    KNOWN_BLOCK_TYPES
  ).sort();
}

export function getDBotEngineVersion() {
  return DBOT_ENGINE_VERSION;
}

export {
  CONTRACT_TYPE_MAP,
  TRADE_TYPE_MAP,
  KNOWN_BLOCK_TYPES,
};
