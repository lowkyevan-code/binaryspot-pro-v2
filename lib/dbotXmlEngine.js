/*
 * BinarySpot Pro
 * D-Bot XML Runtime Engine
 *
 * File:
 *   lib/dbotXmlEngine.js
 *
 * IMPORTANT
 * ---------
 * The original XML remains the strategy source of truth.
 *
 * This runtime interprets supported Blockly/D-Bot blocks directly.
 * It does NOT translate a bot into BinarySpot's native strategy engine.
 *
 * Unknown/custom blocks are FAIL-CLOSED:
 * a bot using semantics we cannot reproduce exactly is marked
 * non-executable rather than being approximated.
 */

export const DBOT_ENGINE_VERSION = '2.0.0';

const ROOT_BLOCKS = new Set([
  'trade_definition',
  'before_purchase',
  'during_purchase',
  'after_purchase',
]);

const CONFIG_BLOCKS = new Set([
  'trade_definition',
  'trade_definition_market',
  'trade_definition_tradetype',
  'trade_definition_contracttype',
  'trade_definition_candleinterval',
  'trade_definition_restartbuysell',
  'trade_definition_restartonerror',
  'trade_definition_tradeoptions',
  'trade_definition_accumulator',

  'riskmanagment_settings',
  'enable_martingale',
  'use_split_martingale',
  'martingale',
  'take_profit',
  'stop_loss',
  'max_split',
]);

const VALUE_BLOCKS = new Set([
  'math_number',
  'math_number_positive',
  'math_arithmetic',
  'math_single',
  'math_round',
  'math_random_int',
  'math_number_property',

  'logic_boolean',
  'logic_null',
  'logic_compare',
  'logic_operation',
  'logic_ternary',

  'variables_get',

  'text',
  'text_join',

  'last_digit',
  'lastDigitList',
  'lists_getIndex',

  'total_profit',
  'total_runs',

  'contract_check_result',
  'read_details',

  'procedures_callreturn',
]);

const STATEMENT_BLOCKS = new Set([
  'variables_set',
  'variable_sets',
  'math_change',

  'controls_if',

  'purchase',
  'apollo_purchase',

  'trade_again',

  'notify',
  'btnotify',
  'text_print',
  'text_statement',

  'timeout',

  'procedures_callnoreturn',

  'sell_at_market',
]);

const PROCEDURE_BLOCKS = new Set([
  'procedures_defnoreturn',
  'procedures_defreturn',
  'procedures_callnoreturn',
  'procedures_callreturn',
]);

const PASSIVE_ANALYSIS_BLOCKS = new Set([
  'tick_analysis',
]);

/*
 * These blocks occur in the supplied XML files, but exact behavior
 * depends on DBot/custom extensions that cannot safely be inferred
 * from the XML structure alone.
 */
const UNSUPPORTED_EXACT_BLOCKS = new Set([
  'custom_prediction_setter_v2',
  'digit_frequency_analysis_v2',
  'last_digits_condition_v2',
  'ph_exec_buy',
  'ph_notify_pro',
  'purchase_universal',

  'input_list',
  'ohlc',
  'ohlc_values_in_list',
  'period',
  'rsi_statement',
  'sma_statement',
  'tick',

  'stat',

  'accumulator_take_profit',
  'check_sell',
]);

const ALL_KNOWN_BLOCKS = new Set([
  ...ROOT_BLOCKS,
  ...CONFIG_BLOCKS,
  ...VALUE_BLOCKS,
  ...STATEMENT_BLOCKS,
  ...PROCEDURE_BLOCKS,
  ...PASSIVE_ANALYSIS_BLOCKS,
  ...UNSUPPORTED_EXACT_BLOCKS,
]);

function fail(message, details = null) {
  const error = new Error(
    `[D-Bot XML Engine] ${message}`
  );

  error.name = 'DBotXmlEngineError';
  error.details = details;

  throw error;
}

function number(value, fallback = 0) {
  const result = Number(value);

  return Number.isFinite(result)
    ? result
    : fallback;
}

function string(value, fallback = '') {
  if (
    value === undefined ||
    value === null
  ) {
    return fallback;
  }

  return String(value);
}

function boolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  const normalized = string(value)
    .trim()
    .toLowerCase();

  if (
    normalized === 'false' ||
    normalized === '0' ||
    normalized === '' ||
    normalized === 'null' ||
    normalized === 'undefined'
  ) {
    return false;
  }

  return true;
}

function elementChildren(node, tagName) {
  if (!node) {
    return [];
  }

  return Array.from(node.children || []).filter(
    (child) =>
      !tagName ||
      child.tagName?.toLowerCase() ===
        tagName.toLowerCase()
  );
}

function firstElement(node, tagName) {
  return (
    elementChildren(node, tagName)[0] ||
    null
  );
}

function fieldMap(node) {
  const result = {};

  for (const field of elementChildren(
    node,
    'field'
  )) {
    result[field.getAttribute('name')] =
      field.textContent ?? '';
  }

  return result;
}

function mutationData(node) {
  const mutation = firstElement(
    node,
    'mutation'
  );

  if (!mutation) {
    return null;
  }

  const attributes = {};

  for (const attr of Array.from(
    mutation.attributes || []
  )) {
    attributes[attr.name] = attr.value;
  }

  const args = elementChildren(
    mutation,
    'arg'
  ).map((arg) => ({
    name:
      arg.getAttribute('name') || '',
  }));

  return {
    attributes,
    args,
  };
}

function parseConnection(container) {
  if (!container) {
    return null;
  }

  const children =
    elementChildren(container);

  /*
   * Blockly may place a shadow followed by the actual block.
   * The actual block takes precedence.
   */
  const actual =
    children.find(
      (child) =>
        child.tagName?.toLowerCase() ===
        'block'
    );

  const shadow =
    children.find(
      (child) =>
        child.tagName?.toLowerCase() ===
        'shadow'
    );

  return parseBlock(
    actual || shadow
  );
}

function parseNamedConnections(
  node,
  tagName
) {
  const result = {};

  for (const connection of elementChildren(
    node,
    tagName
  )) {
    const name =
      connection.getAttribute('name');

    if (!name) {
      continue;
    }

    result[name] =
      parseConnection(connection);
  }

  return result;
}

function parseNext(node) {
  const next =
    firstElement(
      node,
      'next'
    );

  return parseConnection(next);
}

function parseBlock(node) {
  if (!node) {
    return null;
  }

  const tag =
    node.tagName?.toLowerCase();

  if (
    tag !== 'block' &&
    tag !== 'shadow'
  ) {
    return null;
  }

  return {
    type:
      node.getAttribute('type') || '',

    id:
      node.getAttribute('id') || null,

    shadow:
      tag === 'shadow',

    fields:
      fieldMap(node),

    mutation:
      mutationData(node),

    values:
      parseNamedConnections(
        node,
        'value'
      ),

    statements:
      parseNamedConnections(
        node,
        'statement'
      ),

    next:
      parseNext(node),
  };
}

function flattenBlocks(block, result = []) {
  if (!block) {
    return result;
  }

  result.push(block);

  for (const child of Object.values(
    block.values || {}
  )) {
    flattenBlocks(child, result);
  }

  for (const child of Object.values(
    block.statements || {}
  )) {
    flattenBlocks(child, result);
  }

  flattenBlocks(
    block.next,
    result
  );

  return result;
}

function parseVariables(xml) {
  const variables = {};

  const variablesNode =
    Array.from(
      xml.documentElement.children || []
    ).find(
      (node) =>
        node.tagName?.toLowerCase() ===
        'variables'
    );

  if (!variablesNode) {
    return variables;
  }

  for (const node of elementChildren(
    variablesNode,
    'variable'
  )) {
    const id =
      node.getAttribute('id') ||
      node.textContent ||
      `variable-${Object.keys(variables).length}`;

    variables[id] = {
      id,
      name:
        node.textContent || id,
      type:
        node.getAttribute('type') || '',
    };
  }

  return variables;
}

function findBlock(
  blocks,
  type
) {
  return (
    blocks.find(
      (block) =>
        block.type === type
    ) || null
  );
}

function findAllBlocks(
  blocks,
  type
) {
  return blocks.filter(
    (block) =>
      block.type === type
  );
}

function getTradeDefinitionParts(
  tradeDefinition
) {
  if (!tradeDefinition) {
    return {
      optionBlocks: [],
      initialization: null,
      submarket: null,
    };
  }

  const optionBlocks =
    flattenBlocks(
      tradeDefinition
        .statements
        ?.TRADE_OPTIONS,
      []
    );

  return {
    optionBlocks,

    initialization:
      tradeDefinition
        .statements
        ?.INITIALIZATION ||
      null,

    submarket:
      tradeDefinition
        .statements
        ?.SUBMARKET ||
      null,
  };
}

function extractTradeConfig(
  tradeDefinition
) {
  const {
    optionBlocks,
    initialization,
    submarket,
  } =
    getTradeDefinitionParts(
      tradeDefinition
    );

  const market =
    findBlock(
      optionBlocks,
      'trade_definition_market'
    );

  const tradeType =
    findBlock(
      optionBlocks,
      'trade_definition_tradetype'
    );

  const contractType =
    findBlock(
      optionBlocks,
      'trade_definition_contracttype'
    );

  const candle =
    findBlock(
      optionBlocks,
      'trade_definition_candleinterval'
    );

  const restartBuySell =
    findBlock(
      optionBlocks,
      'trade_definition_restartbuysell'
    );

  const restartError =
    findBlock(
      optionBlocks,
      'trade_definition_restartonerror'
    );

  const tradeOptions =
    findBlock(
      flattenBlocks(
        submarket,
        []
      ),
      'trade_definition_tradeoptions'
    );

  const accumulator =
    findBlock(
      flattenBlocks(
        submarket,
        []
      ),
      'trade_definition_accumulator'
    );

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
      tradeType?.fields
        ?.TRADETYPE_LIST ||
      null,

    contractSelection:
      contractType?.fields
        ?.TYPE_LIST ||
      null,

    candleInterval:
      number(
        candle?.fields
          ?.CANDLEINTERVAL_LIST,
        null
      ),

    timeMachineEnabled:
      boolean(
        restartBuySell?.fields
          ?.TIME_MACHINE_ENABLED
      ),

    restartOnError:
      boolean(
        restartError?.fields
          ?.RESTARTONERROR
      ),

    durationType:
      tradeOptions?.fields
        ?.DURATIONTYPE_LIST ||
      accumulator?.fields
        ?.DURATIONTYPE_LIST ||
      't',

    tradeOptionsBlock:
      tradeOptions ||
      accumulator ||
      null,

    initializationBlock:
      initialization,

    accumulator:
      Boolean(accumulator),

    availableContracts:
      [],
  };
}

function extractRiskConfig(
  allBlocks
) {
  const settings =
    findBlock(
      allBlocks,
      'riskmanagment_settings'
    );

  if (!settings) {
    return null;
  }

  const children =
    flattenBlocks(
      settings,
      []
    );

  const read =
    (type) =>
      findBlock(
        children,
        type
      );

  return {
    enabled:
      boolean(
        read(
          'enable_martingale'
        )?.fields?.ENABLED ??
          read(
            'enable_martingale'
          )?.fields?.VALUE
      ),

    splitMartingale:
      boolean(
        read(
          'use_split_martingale'
        )?.fields?.ENABLED ??
          read(
            'use_split_martingale'
          )?.fields?.VALUE
      ),

    martingale:
      number(
        read('martingale')
          ?.fields?.VALUE ??
          read('martingale')
            ?.fields?.MARTINGALE,
        null
      ),

    takeProfit:
      number(
        read('take_profit')
          ?.fields?.VALUE ??
          read('take_profit')
            ?.fields?.TAKE_PROFIT,
        null
      ),

    stopLoss:
      number(
        read('stop_loss')
          ?.fields?.VALUE ??
          read('stop_loss')
            ?.fields?.STOP_LOSS,
        null
      ),

    maxSplit:
      number(
        read('max_split')
          ?.fields?.VALUE ??
          read('max_split')
            ?.fields?.MAX_SPLIT,
        null
      ),
  };
}

function procedureName(
  block
) {
  return (
    block?.mutation
      ?.attributes?.name ||
    block?.fields?.NAME ||
    ''
  );
}

function buildProcedureTable(
  topLevelBlocks
) {
  const procedures =
    new Map();

  for (const root of topLevelBlocks) {
    const blocks =
      flattenBlocks(
        root,
        []
      );

    for (const block of blocks) {
      if (
        block.type !==
          'procedures_defnoreturn' &&
        block.type !==
          'procedures_defreturn'
      ) {
        continue;
      }

      const name =
        block.fields?.NAME ||
        procedureName(block);

      if (!name) {
        continue;
      }

      procedures.set(
        name,
        block
      );
    }
  }

  return procedures;
}

function analyzeCompatibility(
  allBlocks,
  procedures
) {
  const unsupported = [];
  const unknown = [];

  for (const block of allBlocks) {
    if (
      UNSUPPORTED_EXACT_BLOCKS.has(
        block.type
      )
    ) {
      unsupported.push({
        type: block.type,
        id: block.id,
        reason:
          'Exact runtime semantics are not implemented.',
      });

      continue;
    }

    if (
      !ALL_KNOWN_BLOCKS.has(
        block.type
      )
    ) {
      unknown.push({
        type: block.type,
        id: block.id,
        reason:
          'Unknown Blockly/D-Bot block.',
      });
    }
  }

  /*
   * Calls to procedures whose definitions are absent cannot
   * be safely interpreted.
   */
  for (const block of allBlocks) {
    if (
      block.type !==
        'procedures_callnoreturn' &&
      block.type !==
        'procedures_callreturn'
    ) {
      continue;
    }

    const name =
      procedureName(block);

    if (
      name &&
      !procedures.has(name)
    ) {
      unsupported.push({
        type: block.type,
        id: block.id,
        procedure: name,
        reason:
          `Procedure "${name}" is called but not defined in the XML.`,
      });
    }
  }

  const dedupe =
    (items) => {
      const seen =
        new Set();

      return items.filter(
        (item) => {
          const key =
            `${item.type}:${item.id}:${item.procedure || ''}`;

          if (seen.has(key)) {
            return false;
          }

          seen.add(key);
          return true;
        }
      );
    };

  const unsupportedBlocks =
    dedupe([
      ...unsupported,
      ...unknown,
    ]);

  return {
    executable:
      unsupportedBlocks.length ===
      0,

    unsupportedBlocks,

    unknownBlocks:
      dedupe(unknown),

    supportedBlockCount:
      allBlocks.length -
      unsupportedBlocks.length,

    totalBlockCount:
      allBlocks.length,
  };
}

export function parseDBotXml(
  xmlText,
  options = {}
) {
  if (
    typeof DOMParser ===
    'undefined'
  ) {
    fail(
      'DOMParser is unavailable. D-Bot XML parsing must run in the browser.'
    );
  }

  if (
    typeof xmlText !==
      'string' ||
    !xmlText.trim()
  ) {
    fail(
      'A non-empty XML string is required.'
    );
  }

  const parser =
    new DOMParser();

  const xml =
    parser.parseFromString(
      xmlText,
      'application/xml'
    );

  const parserError =
    xml.querySelector(
      'parsererror'
    );

  if (parserError) {
    fail(
      'Invalid XML.',
      parserError.textContent
    );
  }

  const root =
    xml.documentElement;

  if (
    !root ||
    root.tagName
      ?.toLowerCase() !==
      'xml'
  ) {
    fail(
      'The document is not a Blockly XML document.'
    );
  }

  const topLevelBlocks =
    elementChildren(root)
      .filter(
        (node) =>
          node.tagName
            ?.toLowerCase() ===
          'block'
      )
      .map(parseBlock)
      .filter(Boolean);

  const allBlocks =
    topLevelBlocks.flatMap(
      (block) =>
        flattenBlocks(
          block,
          []
        )
    );

  const tradeDefinition =
    topLevelBlocks.find(
      (block) =>
        block.type ===
        'trade_definition'
    );

  const beforePurchase =
    topLevelBlocks.find(
      (block) =>
        block.type ===
        'before_purchase'
    );

  const duringPurchase =
    topLevelBlocks.find(
      (block) =>
        block.type ===
        'during_purchase'
    );

  const afterPurchase =
    topLevelBlocks.find(
      (block) =>
        block.type ===
        'after_purchase'
    );

  const procedures =
    buildProcedureTable(
      topLevelBlocks
    );

  const trade =
    extractTradeConfig(
      tradeDefinition
    );

  const purchaseTypes =
    allBlocks
      .filter(
        (block) =>
          block.type ===
            'purchase' ||
          block.type ===
            'apollo_purchase'
      )
      .map(
        (block) =>
          block.fields
            ?.PURCHASE_LIST
      )
      .filter(Boolean);

  trade.availableContracts =
    Array.from(
      new Set(
        purchaseTypes
      )
    );

  const compatibility =
    analyzeCompatibility(
      allBlocks,
      procedures
    );

  return {
    source: {
      fileName:
        options.fileName ||
        'D-Bot.xml',

      xml:
        xmlText,
    },

    variables:
      parseVariables(xml),

    trade,

    risk:
      extractRiskConfig(
        allBlocks
      ),

    roots: {
      tradeDefinition,
      beforePurchase,
      duringPurchase,
      afterPurchase,
    },

    procedures,

    topLevelBlocks,

    allBlocks,

    compatibility,
  };
}

export async function parseDBotFile(
  file
) {
  if (!file) {
    fail(
      'No XML file was supplied.'
    );
  }

  const xmlText =
    await file.text();

  return parseDBotXml(
    xmlText,
    {
      fileName:
        file.name ||
        'D-Bot.xml',
    }
  );
}

function variableId(
  block
) {
  return (
    block?.fields?.VAR ||
    null
  );
}

function createInitialVariables(
  model
) {
  const values = {};

  for (const variable of Object.values(
    model.variables || {}
  )) {
    values[variable.id] = 0;
  }

  return values;
}

function normalizeTick(
  input
) {
  const quote =
    number(
      input?.quote,
      NaN
    );

  if (
    !Number.isFinite(quote)
  ) {
    fail(
      'Tick quote must be numeric.'
    );
  }

  const pipSize =
    Number.isFinite(
      Number(
        input?.pipSize
      )
    )
      ? Number(
          input.pipSize
        )
      : null;

  let text;

  if (
    pipSize !== null
  ) {
    text =
      quote.toFixed(
        pipSize
      );
  } else {
    text =
      String(quote);
  }

  const digitMatch =
    text.match(
      /(\d)(?!.*\d)/
    );

  return {
    quote,

    epoch:
      number(
        input?.epoch,
        Date.now() / 1000
      ),

    pipSize,

    lastDigit:
      digitMatch
        ? Number(
            digitMatch[1]
          )
        : Math.abs(
            Math.trunc(
              quote
            )
          ) % 10,
  };
}

function createRuntimeError(
  message,
  block
) {
  const error =
    new Error(
      `[D-Bot Runtime] ${message}`
    );

  error.name =
    'DBotRuntimeError';

  error.blockType =
    block?.type ||
    null;

  error.blockId =
    block?.id ||
    null;

  return error;
}

export function createDBotRuntime(
  model,
  options = {}
) {
  if (!model) {
    fail(
      'A parsed D-Bot model is required.'
    );
  }

  const runtime = {
    model,

    variables:
      createInitialVariables(
        model
      ),

    ticks: [],

    contract: null,

    totalProfit: 0,

    totalRuns: 0,

    initialized: false,

    effects: [],

    callDepth: 0,

    maxCallDepth:
      options.maxCallDepth ||
      100,

    maxTicks:
      options.maxTicks ||
      1000,
  };

  function getVariable(
    idOrName
  ) {
    if (
      Object.prototype
        .hasOwnProperty.call(
          runtime.variables,
          idOrName
        )
    ) {
      return runtime.variables[
        idOrName
      ];
    }

    const variable =
      Object.values(
        model.variables ||
          {}
      ).find(
        (item) =>
          item.name ===
          idOrName
      );

    if (!variable) {
      return undefined;
    }

    return runtime.variables[
      variable.id
    ];
  }

  function setVariable(
    idOrName,
    value
  ) {
    if (
      Object.prototype
        .hasOwnProperty.call(
          runtime.variables,
          idOrName
        )
    ) {
      runtime.variables[
        idOrName
      ] = value;

      return value;
    }

    const variable =
      Object.values(
        model.variables ||
          {}
      ).find(
        (item) =>
          item.name ===
          idOrName
      );

    if (!variable) {
      runtime.variables[
        idOrName
      ] = value;

      return value;
    }

    runtime.variables[
      variable.id
    ] = value;

    return value;
  }

  function emit(
    effect
  ) {
    runtime.effects.push(
      effect
    );

    return effect;
  }

  function lastTick() {
    return (
      runtime.ticks[
        runtime.ticks.length -
          1
      ] || null
    );
  }

  function lastDigits(
    count = null
  ) {
    const digits =
      runtime.ticks.map(
        (tick) =>
          tick.lastDigit
      );

    if (
      count === null
    ) {
      return digits;
    }

    return digits.slice(
      -Math.max(
        0,
        Math.trunc(
          number(count, 0)
        )
      )
    );
  }

  function contractResult(
    expected
  ) {
    const normalized =
      string(expected)
        .toLowerCase();

    const profit =
      number(
        runtime.contract
          ?.profit,
        0
      );

    const result =
      string(
        runtime.contract
          ?.result
      ).toLowerCase();

    if (
      normalized === 'win'
    ) {
      return (
        result === 'win' ||
        profit > 0
      );
    }

    if (
      normalized === 'loss'
    ) {
      return (
        result === 'loss' ||
        profit < 0
      );
    }

    return (
      result === normalized
    );
  }

  function readContractDetail(
    index
  ) {
    const contract =
      runtime.contract ||
      {};

    const numeric =
      Math.trunc(
        number(
          index,
          -1
        )
      );

    /*
     * Common DBot contract detail indexes.
     * Profit is especially important because many XML bots
     * use DETAIL_INDEX=4 after settlement.
     */
    const known = {
      0:
        contract.buy_price ??
        contract.buyPrice ??
        0,

      1:
        contract.payout ??
        0,

      2:
        contract.sell_price ??
        contract.sellPrice ??
        0,

      3:
        contract.entry_tick ??
        contract.entryTick ??
        0,

      4:
        contract.profit ??
        0,

      5:
        contract.exit_tick ??
        contract.exitTick ??
        0,
    };

    if (
      Object.prototype
        .hasOwnProperty.call(
          known,
          numeric
        )
    ) {
      return known[
        numeric
      ];
    }

    return (
      contract[
        numeric
      ] ??
      null
    );
  }

  function callProcedure(
    block,
    wantsReturn
  ) {
    const name =
      procedureName(
        block
      );

    const definition =
      model.procedures.get(
        name
      );

    if (!definition) {
      throw createRuntimeError(
        `Procedure "${name}" is not defined.`,
        block
      );
    }

    runtime.callDepth += 1;

    if (
      runtime.callDepth >
      runtime.maxCallDepth
    ) {
      runtime.callDepth -= 1;

      throw createRuntimeError(
        `Maximum procedure depth exceeded while calling "${name}".`,
        block
      );
    }

    try {
      const args =
        block.mutation
          ?.args ||
        [];

      const previous = [];

      for (
        let index = 0;
        index <
        args.length;
        index += 1
      ) {
        const argName =
          args[index]
            ?.name;

        if (!argName) {
          continue;
        }

        previous.push({
          name: argName,
          value:
            getVariable(
              argName
            ),
        });

        setVariable(
          argName,
          evaluateValue(
            block.values?.[
              `ARG${index}`
            ]
          )
        );
      }

      executeChain(
        definition.statements
          ?.STACK ||
        definition.statements
          ?.DO ||
        null
      );

      let result;

      if (wantsReturn) {
        result =
          evaluateValue(
            definition.values
              ?.RETURN
          );
      }

      for (
        const item of
        previous
      ) {
        setVariable(
          item.name,
          item.value
        );
      }

      return result;
    } finally {
      runtime.callDepth -= 1;
    }
  }

  function evaluateValue(
    block
  ) {
    if (!block) {
      return null;
    }

    switch (
      block.type
    ) {
      case 'math_number':
      case 'math_number_positive':
        return number(
          block.fields?.NUM,
          0
        );

      case 'text':
        return (
          block.fields?.TEXT ||
          ''
        );

      case 'logic_boolean':
        return (
          string(
            block.fields
              ?.BOOL
          ).toUpperCase() ===
          'TRUE'
        );

      case 'logic_null':
        return null;

      case 'variables_get':
        return getVariable(
          variableId(block)
        );

      case 'math_arithmetic': {
        const a =
          number(
            evaluateValue(
              block.values?.A
            ),
            0
          );

        const b =
          number(
            evaluateValue(
              block.values?.B
            ),
            0
          );

        switch (
          block.fields?.OP
        ) {
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
            return a ** b;

          default:
            throw createRuntimeError(
              `Unsupported arithmetic operation "${block.fields?.OP}".`,
              block
            );
        }
      }

      case 'math_single': {
        const value =
          number(
            evaluateValue(
              block.values?.NUM
            ),
            0
          );

        switch (
          block.fields?.OP
        ) {
          case 'ROOT':
            return Math.sqrt(
              value
            );

          case 'ABS':
            return Math.abs(
              value
            );

          case 'NEG':
            return -value;

          case 'LN':
            return Math.log(
              value
            );

          case 'LOG10':
            return Math.log10(
              value
            );

          case 'EXP':
            return Math.exp(
              value
            );

          case 'POW10':
            return 10 ** value;

          default:
            throw createRuntimeError(
              `Unsupported math operation "${block.fields?.OP}".`,
              block
            );
        }
      }

      case 'math_round': {
        const value =
          number(
            evaluateValue(
              block.values?.NUM
            ),
            0
          );

        switch (
          block.fields?.OP
        ) {
          case 'ROUND':
            return Math.round(
              value
            );

          case 'ROUNDUP':
            return Math.ceil(
              value
            );

          case 'ROUNDDOWN':
            return Math.floor(
              value
            );

          default:
            throw createRuntimeError(
              `Unsupported rounding operation "${block.fields?.OP}".`,
              block
            );
        }
      }

      case 'math_random_int': {
        const from =
          Math.ceil(
            number(
              evaluateValue(
                block.values?.FROM
              ),
              0
            )
          );

        const to =
          Math.floor(
            number(
              evaluateValue(
                block.values?.TO
              ),
              0
            )
          );

        const min =
          Math.min(
            from,
            to
          );

        const max =
          Math.max(
            from,
            to
          );

        return (
          Math.floor(
            Math.random() *
              (max -
                min +
                1)
          ) + min
        );
      }

      case 'math_number_property': {
        const value =
          number(
            evaluateValue(
              block.values
                ?.NUMBER_TO_CHECK
            ),
            0
          );

        switch (
          block.fields
            ?.PROPERTY
        ) {
          case 'EVEN':
            return (
              value % 2 ===
              0
            );

          case 'ODD':
            return (
              Math.abs(
                value % 2
              ) === 1
            );

          case 'POSITIVE':
            return value > 0;

          case 'NEGATIVE':
            return value < 0;

          case 'WHOLE':
            return Number.isInteger(
              value
            );

          default:
            throw createRuntimeError(
              `Unsupported number property "${block.fields?.PROPERTY}".`,
              block
            );
        }
      }

      case 'logic_compare': {
        const a =
          evaluateValue(
            block.values?.A
          );

        const b =
          evaluateValue(
            block.values?.B
          );

        switch (
          block.fields?.OP
        ) {
          case 'EQ':
            return a == b;

          case 'NEQ':
            return a != b;

          case 'LT':
            return a < b;

          case 'LTE':
            return a <= b;

          case 'GT':
            return a > b;

          case 'GTE':
            return a >= b;

          default:
            throw createRuntimeError(
              `Unsupported comparison "${block.fields?.OP}".`,
              block
            );
        }
      }

      case 'logic_operation': {
        const op =
          block.fields?.OP;

        if (
          op === 'AND'
        ) {
          return (
            boolean(
              evaluateValue(
                block.values?.A
              )
            ) &&
            boolean(
              evaluateValue(
                block.values?.B
              )
            )
          );
        }

        if (
          op === 'OR'
        ) {
          return (
            boolean(
              evaluateValue(
                block.values?.A
              )
            ) ||
            boolean(
              evaluateValue(
                block.values?.B
              )
            )
          );
        }

        throw createRuntimeError(
          `Unsupported logical operation "${op}".`,
          block
        );
      }

      case 'logic_ternary':
        return boolean(
          evaluateValue(
            block.values?.IF
          )
        )
          ? evaluateValue(
              block.values?.THEN
            )
          : evaluateValue(
              block.values?.ELSE
            );

      case 'text_join': {
        const entries =
          Object.entries(
            block.values ||
              {}
          )
            .filter(
              ([name]) =>
                name.startsWith(
                  'ADD'
                )
            )
            .sort(
              ([a], [b]) =>
                number(
                  a.replace(
                    'ADD',
                    ''
                  ),
                  0
                ) -
                number(
                  b.replace(
                    'ADD',
                    ''
                  ),
                  0
                )
            );

        return entries
          .map(
            ([, value]) =>
              string(
                evaluateValue(
                  value
                )
              )
          )
          .join('');
      }

      case 'last_digit':
        return (
          lastTick()
            ?.lastDigit ??
          null
        );

      case 'lastDigitList': {
        const count =
          evaluateValue(
            block.values?.NUM ??
            block.values
              ?.COUNT ??
            block.values
              ?.TICKS
          );

        return lastDigits(
          count === null
            ? null
            : count
        );
      }

      case 'lists_getIndex': {
        const list =
          evaluateValue(
            block.values?.VALUE
          );

        if (
          !Array.isArray(
            list
          )
        ) {
          return null;
        }

        const where =
          block.fields
            ?.WHERE ||
          'FROM_START';

        if (
          where ===
          'FIRST'
        ) {
          return list[0];
        }

        if (
          where ===
          'LAST'
        ) {
          return list[
            list.length -
              1
          ];
        }

        const rawIndex =
          number(
            evaluateValue(
              block.values?.AT
            ),
            1
          );

        if (
          where ===
          'FROM_END'
        ) {
          return list[
            list.length -
              Math.trunc(
                rawIndex
              )
          ];
        }

        return list[
          Math.max(
            0,
            Math.trunc(
              rawIndex
            ) - 1
          )
        ];
      }

      case 'total_profit':
        return runtime
          .totalProfit;

      case 'total_runs':
        return runtime
          .totalRuns;

      case 'contract_check_result':
        return contractResult(
          block.fields
            ?.CHECK_RESULT
        );

      case 'read_details':
        return readContractDetail(
          block.fields
            ?.DETAIL_INDEX
        );

      case 'procedures_callreturn':
        return callProcedure(
          block,
          true
        );

      default:
        if (
          UNSUPPORTED_EXACT_BLOCKS.has(
            block.type
          )
        ) {
          throw createRuntimeError(
            `Exact semantics for "${block.type}" are not implemented.`,
            block
          );
        }

        throw createRuntimeError(
          `Unsupported value block "${block.type}".`,
          block
        );
    }
  }

  function executeIf(
    block
  ) {
    let index = 0;

    while (
      Object.prototype
        .hasOwnProperty.call(
          block.values,
          `IF${index}`
        )
    ) {
      if (
        boolean(
          evaluateValue(
            block.values[
              `IF${index}`
            ]
          )
        )
      ) {
        executeChain(
          block.statements[
            `DO${index}`
          ]
        );

        return;
      }

      index += 1;
    }

    if (
      block.statements
        ?.ELSE
    ) {
      executeChain(
        block.statements
          .ELSE
      );
    }
  }

  function executeStatement(
    block
  ) {
    switch (
      block.type
    ) {
      case 'variables_set':
      case 'variable_sets': {
        const value =
          evaluateValue(
            block.values
              ?.VALUE
          );

        setVariable(
          variableId(block),
          value
        );

        emit({
          type:
            'VARIABLE_SET',

          variable:
            variableId(
              block
            ),

          value,
        });

        return;
      }

      case 'math_change': {
        const id =
          variableId(
            block
          );

        const current =
          number(
            getVariable(id),
            0
          );

        const delta =
          number(
            evaluateValue(
              block.values
                ?.DELTA
            ),
            0
          );

        const value =
          current + delta;

        setVariable(
          id,
          value
        );

        emit({
          type:
            'VARIABLE_CHANGE',

          variable: id,

          delta,

          value,
        });

        return;
      }

      case 'controls_if':
        executeIf(block);
        return;

      case 'purchase':
      case 'apollo_purchase': {
        const contractType =
          block.fields
            ?.PURCHASE_LIST;

        if (
          !contractType
        ) {
          throw createRuntimeError(
            'Purchase block has no contract type.',
            block
          );
        }

        emit({
          type:
            'PURCHASE',

          contractType,

          blockType:
            block.type,

          blockId:
            block.id,
        });

        return;
      }

      case 'trade_again':
        emit({
          type:
            'TRADE_AGAIN',

          blockId:
            block.id,
        });

        return;

      case 'notify':
      case 'btnotify':
      case 'text_print':
      case 'text_statement': {
        const message =
          evaluateValue(
            block.values
              ?.MESSAGE ??
            block.values
              ?.TEXT ??
            block.values
              ?.VALUE
          ) ??
          block.fields
            ?.TEXT ??
          '';

        emit({
          type:
            'MESSAGE',

          level:
            block.fields
              ?.NOTIFICATION_TYPE ||
            'info',

          message:
            string(message),

          blockType:
            block.type,
        });

        return;
      }

      case 'timeout': {
        const duration =
          number(
            evaluateValue(
              block.values
                ?.SECONDS ??
              block.values
                ?.TIME ??
              block.values
                ?.DURATION
            ),
            number(
              block.fields
                ?.SECONDS ??
              block.fields
                ?.TIME,
              0
            )
          );

        emit({
          type:
            'TIMEOUT',

          duration,

          blockId:
            block.id,
        });

        return;
      }

      case 'procedures_callnoreturn':
        callProcedure(
          block,
          false
        );
        return;

      case 'sell_at_market':
        emit({
          type:
            'SELL_AT_MARKET',

          blockId:
            block.id,
        });
        return;

      case 'tick_analysis':
        /*
         * Container/analysis helper in many DBot XML files.
         * Execute nested statements when present.
         */
        for (
          const child of
          Object.values(
            block.statements ||
              {}
          )
        ) {
          executeChain(
            child
          );
        }

        return;

      case 'riskmanagment_settings':
        /*
         * Configuration was parsed separately.
         * Do not independently alter strategy variables.
         */
        return;

      case 'enable_martingale':
      case 'use_split_martingale':
      case 'martingale':
      case 'take_profit':
      case 'stop_loss':
      case 'max_split':
        return;

      default:
        if (
          UNSUPPORTED_EXACT_BLOCKS.has(
            block.type
          )
        ) {
          throw createRuntimeError(
            `Exact semantics for "${block.type}" are not implemented.`,
            block
          );
        }

        if (
          CONFIG_BLOCKS.has(
            block.type
          )
        ) {
          return;
        }

        throw createRuntimeError(
          `Unsupported statement block "${block.type}".`,
          block
        );
    }
  }

  function executeChain(
    start
  ) {
    let block = start;

    let guard = 0;

    while (block) {
      guard += 1;

      if (
        guard > 10000
      ) {
        throw createRuntimeError(
          'Statement execution limit exceeded.',
          block
        );
      }

      executeStatement(
        block
      );

      block =
        block.next;
    }
  }

  function flushEffects() {
    const effects = [
      ...runtime.effects,
    ];

    runtime.effects.length =
      0;

    return effects;
  }

  function initialize() {
    runtime.effects.length =
      0;

    if (
      runtime.initialized
    ) {
      return [];
    }

    executeChain(
      model.trade
        ?.initializationBlock
    );

    runtime.initialized =
      true;

    return flushEffects();
  }

  function pushTick(
    tick
  ) {
    const normalized =
      normalizeTick(
        tick
      );

    runtime.ticks.push(
      normalized
    );

    if (
      runtime.ticks.length >
      runtime.maxTicks
    ) {
      runtime.ticks.splice(
        0,
        runtime.ticks.length -
          runtime.maxTicks
      );
    }

    return normalized;
  }

  function beforePurchase() {
    runtime.effects.length =
      0;

    if (
      !runtime.initialized
    ) {
      initialize();

      runtime.effects.length =
        0;
    }

    const root =
      model.roots
        ?.beforePurchase;

    if (!root) {
      return [];
    }

    executeChain(
      root.statements
        ?.BEFOREPURCHASE_STACK
    );

    return flushEffects();
  }

  function duringPurchase(
    contractUpdate = null
  ) {
    runtime.effects.length =
      0;

    if (
      contractUpdate
    ) {
      runtime.contract = {
        ...(runtime.contract ||
          {}),
        ...contractUpdate,
      };
    }

    const root =
      model.roots
        ?.duringPurchase;

    if (!root) {
      return [];
    }

    executeChain(
      root.statements
        ?.DURING_PURCHASE_STACK ??
      root.statements
        ?.DURINGPURCHASE_STACK
    );

    return flushEffects();
  }

  function afterPurchase(
    contract
  ) {
    runtime.effects.length =
      0;

    runtime.contract = {
      ...(contract ||
        {}),
    };

    runtime.totalRuns += 1;

    runtime.totalProfit +=
      number(
        contract?.profit,
        0
      );

    const root =
      model.roots
        ?.afterPurchase;

    if (!root) {
      return [];
    }

    executeChain(
      root.statements
        ?.AFTERPURCHASE_STACK
    );

    return flushEffects();
  }

  runtime.initialize =
    initialize;

  runtime.pushTick =
    pushTick;

  runtime.beforePurchase =
    beforePurchase;

  runtime.duringPurchase =
    duringPurchase;

  runtime.afterPurchase =
    afterPurchase;

  runtime.getVariable =
    getVariable;

  runtime.setVariable =
    setVariable;

  runtime.evaluateValue =
    evaluateValue;

  runtime.executeChain =
    executeChain;

  runtime.getLastDigits =
    lastDigits;

  runtime.getLastTick =
    lastTick;

  runtime.getState =
    () => ({
      variables: {
        ...runtime.variables,
      },

      ticks: [
        ...runtime.ticks,
      ],

      contract:
        runtime.contract
          ? {
              ...runtime.contract,
            }
          : null,

      totalProfit:
        runtime.totalProfit,

      totalRuns:
        runtime.totalRuns,

      initialized:
        runtime.initialized,
    });

  return runtime;
}

export function inspectDBotModel(
  model
) {
  if (!model) {
    return null;
  }

  const blockTypes =
    Array.from(
      new Set(
        (
          model.allBlocks ||
          []
        ).map(
          (block) =>
            block.type
        )
      )
    ).sort();

  return {
    fileName:
      model.source
        ?.fileName ||
      null,

    variableCount:
      Object.keys(
        model.variables ||
          {}
      ).length,

    blockCount:
      (
        model.allBlocks ||
        []
      ).length,

    blockTypes,

    symbol:
      model.trade
        ?.symbol ||
      null,

    tradeTypeCategory:
      model.trade
        ?.tradeTypeCategory ||
      null,

    tradeType:
      model.trade
        ?.tradeType ||
      null,

    contractSelection:
      model.trade
        ?.contractSelection ||
      null,

    availableContracts: [
      ...(
        model.trade
          ?.availableContracts ||
        []
      ),
    ],

    durationType:
      model.trade
        ?.durationType ||
      null,

    candleInterval:
      model.trade
        ?.candleInterval ??
      null,

    restartOnError:
      model.trade
        ?.restartOnError ??
      null,

    accumulator:
      Boolean(
        model.trade
          ?.accumulator
      ),

    hasBeforePurchase:
      Boolean(
        model.roots
          ?.beforePurchase
      ),

    hasDuringPurchase:
      Boolean(
        model.roots
          ?.duringPurchase
      ),

    hasAfterPurchase:
      Boolean(
        model.roots
          ?.afterPurchase
      ),

    procedureCount:
      model.procedures
        ?.size ||
      0,

    risk:
      model.risk,

    compatibility:
      model.compatibility,
  };
}

export function assertDBotExecutable(
  model
) {
  if (!model) {
    fail(
      'No D-Bot model was supplied.'
    );
  }

  const compatibility =
    model.compatibility;

  if (
    !compatibility
      ?.executable
  ) {
    const names =
      (
        compatibility
          ?.unsupportedBlocks ||
        []
      )
        .map(
          (item) =>
            item.type
        )
        .filter(Boolean);

    const unique =
      Array.from(
        new Set(names)
      );

    fail(
      unique.length
        ? `This XML requires unsupported exact block semantics: ${unique.join(
            ', '
          )}.`
        : 'This XML is not executable by the current engine.',
      compatibility
    );
  }

  return true;
}

export function getDBotVariableByName(
  runtime,
  name
) {
  if (
    !runtime ||
    typeof runtime
      .getVariable !==
      'function'
  ) {
    return undefined;
  }

  return runtime.getVariable(
    name
  );
}

export function setDBotVariableByName(
  runtime,
  name,
  value
) {
  if (
    !runtime ||
    typeof runtime
      .setVariable !==
      'function'
  ) {
    fail(
      'A valid D-Bot runtime is required.'
    );
  }

  return runtime.setVariable(
    name,
    value
  );
}

export function getSupportedDBotBlockTypes() {
  return Array.from(
    new Set([
      ...ROOT_BLOCKS,
      ...CONFIG_BLOCKS,
      ...VALUE_BLOCKS,
      ...STATEMENT_BLOCKS,
      ...PROCEDURE_BLOCKS,
      ...PASSIVE_ANALYSIS_BLOCKS,
    ])
  ).sort();
}

export function getUnsupportedExactDBotBlockTypes() {
  return Array.from(
    UNSUPPORTED_EXACT_BLOCKS
  ).sort();
}

export function getDBotEngineVersion() {
  return DBOT_ENGINE_VERSION;
}

export default {
  parseDBotXml,

  parseDBotFile,

  createDBotRuntime,

  inspectDBotModel,

  assertDBotExecutable,

  getDBotVariableByName,

  setDBotVariableByName,

  getSupportedDBotBlockTypes,

  getUnsupportedExactDBotBlockTypes,

  getVersion:
    getDBotEngineVersion,
};
