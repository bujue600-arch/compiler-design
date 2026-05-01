/**
 * LR(1) 语法分析器
 * 实现LR(1)项目集规范族构建、ACTION/GOTO表生成和语法分析
 */

import { readFileSync } from 'fs';

// 产生式类
export class Production {
  constructor(left, right, index) {
    this.left = left;       // 左部非终结符
    this.right = right;     // 右部符号数组
    this.index = index;     // 产生式编号
  }

  toString() {
    return `${this.left} -> ${this.right.join(' ') || 'ε'}`;
  }
}

// LR(1)项目
export class LR1Item {
  constructor(production, dotPos, lookahead) {
    this.production = production;
    this.dotPos = dotPos;           // 点的位置
    this.lookahead = lookahead;     // 向前看符号
  }

  // 获取点后面的符号
  nextSymbol() {
    return this.dotPos < this.production.right.length
      ? this.production.right[this.dotPos]
      : null;
  }

  // 点是否在最后
  isComplete() {
    return this.dotPos >= this.production.right.length;
  }

  // 移动点
  advance() {
    return new LR1Item(this.production, this.dotPos + 1, this.lookahead);
  }

  equals(other) {
    return this.production.index === other.production.index &&
           this.dotPos === other.dotPos &&
           this.lookahead === other.lookahead;
  }

  toString() {
    const right = [...this.production.right];
    right.splice(this.dotPos, 0, '·');
    return `[${this.production.left} -> ${right.join(' ')}, ${this.lookahead}]`;
  }
}

// 项目集
export class ItemSet {
  constructor(items = [], id = 0) {
    this.items = items;
    this.id = id;
    this.transitions = new Map(); // symbol -> ItemSet
  }

  equals(other) {
    if (this.items.length !== other.items.length) return false;
    for (const item of this.items) {
      if (!other.items.some(o => o.equals(item))) return false;
    }
    return true;
  }

  toString() {
    return this.items.map(i => i.toString()).join('\n');
  }
}

/**
 * LR(1)分析器
 */
export class LR1Parser {
  constructor(grammarFile) {
    this.grammar = this.parseGrammarFile(grammarFile);
    this.augmentedGrammar = this.augmentGrammar();
    this.terminals = new Set();
    this.nonTerminals = new Set();
    this.firstSets = new Map();
    this.itemSets = [];
    this.actionTable = new Map();
    this.gotoTable = new Map();

    this.initSymbols();
    this.computeFirstSets();
    this.buildItemSets();
    this.buildTables();
  }

  /**
   * 解析文法文件
   * 格式：
   * S -> E
   * E -> E + T | T
   * T -> T * F | F
   * F -> ( E ) | id
   */
  parseGrammarFile(filePath) {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));

    const productions = [];
    let prodIndex = 0;

    for (const line of lines) {
      const [left, rightStr] = line.split('->').map(s => s.trim());
      const alternatives = rightStr.split('|').map(s => s.trim());

      for (const alt of alternatives) {
        const right = alt === 'ε' || alt === '' ? [] : alt.split(/\s+/);
        productions.push(new Production(left, right, prodIndex++));
      }
    }

    return productions;
  }

  /**
   * 扩展文法：添加 S' -> S
   */
  augmentGrammar() {
    const startSymbol = this.grammar[0].left;
    const augmented = [
      new Production("S'", [startSymbol], -1),
      ...this.grammar
    ];
    // 更新索引
    augmented.forEach((p, i) => p.index = i);
    return augmented;
  }

  /**
   * 初始化终结符和非终结符
   */
  initSymbols() {
    const leftSymbols = new Set(this.augmentedGrammar.map(p => p.left));
    this.nonTerminals = leftSymbols;

    for (const prod of this.augmentedGrammar) {
      for (const symbol of prod.right) {
        if (!leftSymbols.has(symbol)) {
          this.terminals.add(symbol);
        }
      }
    }
    this.terminals.add('$'); // 结束符
  }

  /**
   * 计算FIRST集
   */
  computeFirstSets() {
    // 初始化
    for (const terminal of this.terminals) {
      this.firstSets.set(terminal, new Set([terminal]));
    }
    for (const nonTerminal of this.nonTerminals) {
      this.firstSets.set(nonTerminal, new Set());
    }

    let changed = true;
    while (changed) {
      changed = false;
      for (const prod of this.augmentedGrammar) {
        const firstSet = this.firstSets.get(prod.left);

        if (prod.right.length === 0) {
          // ε产生式
          if (!firstSet.has('ε')) {
            firstSet.add('ε');
            changed = true;
          }
        } else {
          let allNullable = true;
          for (const symbol of prod.right) {
            const symbolFirst = this.firstSets.get(symbol) || new Set([symbol]);

            for (const terminal of symbolFirst) {
              if (terminal !== 'ε' && !firstSet.has(terminal)) {
                firstSet.add(terminal);
                changed = true;
              }
            }

            if (!symbolFirst.has('ε')) {
              allNullable = false;
              break;
            }
          }

          if (allNullable && !firstSet.has('ε')) {
            firstSet.add('ε');
            changed = true;
          }
        }
      }
    }
  }

  /**
   * 计算符号串的FIRST集
   */
  firstOfString(symbols) {
    const result = new Set();

    if (symbols.length === 0) {
      result.add('ε');
      return result;
    }

    let allNullable = true;
    for (const symbol of symbols) {
      const first = this.firstSets.get(symbol) || new Set([symbol]);

      for (const terminal of first) {
        if (terminal !== 'ε') {
          result.add(terminal);
        }
      }

      if (!first.has('ε')) {
        allNullable = false;
        break;
      }
    }

    if (allNullable) {
      result.add('ε');
    }

    return result;
  }

  /**
   * 计算项目集的闭包
   */
  closure(items) {
    const result = [...items];
    const added = new Set(items.map(i => `${i.production.index},${i.dotPos},${i.lookahead}`));

    let changed = true;
    while (changed) {
      changed = false;
      const currentItems = [...result];

      for (const item of currentItems) {
        const nextSym = item.nextSymbol();
        if (!nextSym || this.terminals.has(nextSym)) continue;

        // 计算向前看符号
        const beta = item.production.right.slice(item.dotPos + 1);
        const lookaheadSet = this.firstOfString([...beta, item.lookahead]);

        // 为非终结符nextSym的所有产生式添加项目
        for (const prod of this.augmentedGrammar) {
          if (prod.left !== nextSym) continue;

          for (const lookahead of lookaheadSet) {
            if (lookahead === 'ε') continue;

            const newItem = new LR1Item(prod, 0, lookahead);
            const key = `${newItem.production.index},${newItem.dotPos},${newItem.lookahead}`;

            if (!added.has(key)) {
              added.add(key);
              result.push(newItem);
              changed = true;
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * 计算GOTO(I, X)
   */
  goto(items, symbol) {
    const result = [];

    for (const item of items) {
      if (item.nextSymbol() === symbol) {
        result.push(item.advance());
      }
    }

    return this.closure(result);
  }

  /**
   * 生成项目集的唯一键
   */
  getItemSetKey(items) {
    return items.map(i => `${i.production.index},${i.dotPos},${i.lookahead}`)
      .sort()
      .join('|');
  }

  /**
   * 构建LR(1)项目集规范族
   */
  buildItemSets() {
    // 初始项目集
    const startProd = this.augmentedGrammar[0];
    const initialItem = new LR1Item(startProd, 0, '$');
    const initialClosure = this.closure([initialItem]);

    const initialSet = new ItemSet(initialClosure, 0);
    this.itemSets.push(initialSet);

    const stateMap = new Map();
    stateMap.set(this.getItemSetKey(initialClosure), 0);

    const queue = [initialSet];

    while (queue.length > 0) {
      const currentSet = queue.shift();

      // 收集所有可能的转移符号
      const symbols = new Set();
      for (const item of currentSet.items) {
        const nextSym = item.nextSymbol();
        if (nextSym) symbols.add(nextSym);
      }

      for (const symbol of symbols) {
        const nextItems = this.goto(currentSet.items, symbol);
        if (nextItems.length === 0) continue;

        // 检查是否已存在相同的项目集
        let existingIndex = -1;
        for (let i = 0; i < this.itemSets.length; i++) {
          if (this.itemSets[i].items.length === nextItems.length) {
            const tempSet = new ItemSet(nextItems);
            if (this.itemSets[i].equals(tempSet)) {
              existingIndex = i;
              break;
            }
          }
        }

        if (existingIndex === -1) {
          const newSet = new ItemSet(nextItems, this.itemSets.length);
          this.itemSets.push(newSet);
          currentSet.transitions.set(symbol, newSet);
          queue.push(newSet);
        } else {
          currentSet.transitions.set(symbol, this.itemSets[existingIndex]);
        }
      }
    }
  }

  /**
   * 构建ACTION和GOTO表
   */
  buildTables() {
    for (const itemSet of this.itemSets) {
      const stateId = itemSet.id;

      // 初始化表项
      if (!this.actionTable.has(stateId)) {
        this.actionTable.set(stateId, new Map());
      }
      if (!this.gotoTable.has(stateId)) {
        this.gotoTable.set(stateId, new Map());
      }

      for (const item of itemSet.items) {
        if (item.isComplete()) {
          // 归约项目
          if (item.production.index === 0) {
            // S' -> S· 接受
            this.actionTable.get(stateId).set('$', 'accept');
          } else {
            // 归约
            const action = `r${item.production.index}`;
            const existing = this.actionTable.get(stateId).get(item.lookahead);

            if (existing && existing !== action) {
              // 冲突
              console.warn(`冲突在状态${stateId}，符号${item.lookahead}：${existing} vs ${action}`);
            }

            this.actionTable.get(stateId).set(item.lookahead, action);
          }
        } else {
          const nextSym = item.nextSymbol();
          const nextState = itemSet.transitions.get(nextSym);

          if (nextState) {
            if (this.terminals.has(nextSym)) {
              // 移进
              const action = `s${nextState.id}`;
              const existing = this.actionTable.get(stateId).get(nextSym);

              if (existing && existing !== action) {
                console.warn(`冲突在状态${stateId}，符号${nextSym}：${existing} vs ${action}`);
              }

              this.actionTable.get(stateId).set(nextSym, action);
            } else {
              // GOTO
              this.gotoTable.get(stateId).set(nextSym, nextState.id);
            }
          }
        }
      }
    }
  }

  /**
   * 语法分析
   * @param {Array} tokens - token列表（来自词法分析器）
   * @returns {Object} - 分析结果
   */
  parse(tokens) {
    const steps = [];
    const stack = [{ state: 0, symbol: '$' }];
    const input = [...tokens.map(t => this.getTokenSymbol(t)), '$'];
    let pos = 0;
    let stepNum = 0;

    steps.push({
      step: stepNum++,
      stack: this.formatStack(stack),
      input: input.slice(pos).join(' '),
      action: '初始状态'
    });

    while (pos < input.length) {
      const currentState = stack[stack.length - 1].state;
      const currentSymbol = input[pos];

      const action = this.actionTable.get(currentState)?.get(currentSymbol);

      if (!action) {
        // 错误
        const errorInfo = this.analyzeError(stack, input, pos, tokens);
        return {
          success: false,
          steps: steps,
          error: errorInfo
        };
      }

      if (action === 'accept') {
        steps.push({
          step: stepNum++,
          stack: this.formatStack(stack),
          input: input.slice(pos).join(' '),
          action: '接受！'
        });
        return {
          success: true,
          steps: steps
        };
      }

      if (action.startsWith('s')) {
        // 移进
        const nextState = parseInt(action.substring(1));
        stack.push({ state: nextState, symbol: currentSymbol });
        pos++;

        steps.push({
          step: stepNum++,
          stack: this.formatStack(stack),
          input: input.slice(pos).join(' '),
          action: `移进到状态${nextState}`
        });
      } else if (action.startsWith('r')) {
        // 归约
        const prodIndex = parseInt(action.substring(1));
        const prod = this.augmentedGrammar[prodIndex];

        // 弹出右部符号
        for (let i = 0; i < prod.right.length; i++) {
          stack.pop();
        }

        // 获取新状态
        const topState = stack[stack.length - 1].state;
        const gotoState = this.gotoTable.get(topState)?.get(prod.left);

        if (gotoState === undefined) {
          return {
            success: false,
            steps: steps,
            error: {
              line: this.getErrorLine(tokens, pos),
              message: `GOTO表错误：状态${topState}，非终结符${prod.left}`
            }
          };
        }

        stack.push({ state: gotoState, symbol: prod.left });

        steps.push({
          step: stepNum++,
          stack: this.formatStack(stack),
          input: input.slice(pos).join(' '),
          action: `归约：${prod.toString()}`
        });
      }
    }

    return {
      success: false,
      steps: steps,
      error: {
        line: tokens.length > 0 ? tokens[tokens.length - 1].line : 0,
        message: '输入不完整'
      }
    };
  }

  /**
   * 将token转换为文法符号
   */
  getTokenSymbol(token) {
    if (token.type === 'IDENTIFIER') return 'id';
    if (token.type === 'CONSTANT') return 'num';
    if (token.type === 'KEYWORD') return token.value;
    if (token.type === 'OPERATOR') return token.value;
    if (token.type === 'DELIMITER') return token.value;
    return token.value;
  }

  /**
   * 格式化分析栈
   */
  formatStack(stack) {
    return stack.map(s => `${s.symbol}${s.state}`).join(' ');
  }

  /**
   * 分析错误原因
   */
  analyzeError(stack, input, pos, tokens) {
    const currentState = stack[stack.length - 1].state;
    const currentSymbol = input[pos];

    // 收集期望的符号
    const expected = [];
    const actionRow = this.actionTable.get(currentState);
    if (actionRow) {
      for (const [symbol, action] of actionRow) {
        if (action.startsWith('s')) expected.push(symbol);
        if (action.startsWith('r')) expected.push(symbol);
      }
    }

    const errorLine = this.getErrorLine(tokens, pos);

    let message = `语法错误：`;
    if (expected.length > 0) {
      message += `期望 ${expected.join(', ')} 之一，`;
    }
    message += `但遇到 "${currentSymbol}"`;

    return {
      line: errorLine,
      message: message,
      expected: expected,
      actual: currentSymbol
    };
  }

  /**
   * 获取错误所在行号
   */
  getErrorLine(tokens, pos) {
    if (pos < tokens.length) {
      return tokens[pos].line;
    }
    return tokens.length > 0 ? tokens[tokens.length - 1].line : 0;
  }

  /**
   * 打印分析表
   */
  printTables() {
    console.log('\n===== ACTION表 =====');
    const terminals = [...this.terminals].sort();

    // 打印表头
    let header = '状态\t';
    for (const t of terminals) {
      header += `${t}\t`;
    }
    console.log(header);

    // 打印每行
    for (let i = 0; i < this.itemSets.length; i++) {
      let row = `${i}\t`;
      for (const t of terminals) {
        const action = this.actionTable.get(i)?.get(t) || '';
        row += `${action}\t`;
      }
      console.log(row);
    }

    console.log('\n===== GOTO表 =====');
    const nonTerminals = [...this.nonTerminals].filter(nt => nt !== "S'").sort();

    header = '状态\t';
    for (const nt of nonTerminals) {
      header += `${nt}\t`;
    }
    console.log(header);

    for (let i = 0; i < this.itemSets.length; i++) {
      let row = `${i}\t`;
      for (const nt of nonTerminals) {
        const gotoVal = this.gotoTable.get(i)?.get(nt);
        row += gotoVal !== undefined ? `${gotoVal}\t` : '\t';
      }
      console.log(row);
    }
  }

  /**
   * 打印项目集规范族
   */
  printItemSets() {
    console.log('\n===== LR(1)项目集规范族 =====');
    for (const itemSet of this.itemSets) {
      console.log(`\n状态 ${itemSet.id}:`);
      for (const item of itemSet.items) {
        console.log(`  ${item.toString()}`);
      }
      if (itemSet.transitions.size > 0) {
        console.log('  转移:');
        for (const [symbol, target] of itemSet.transitions) {
          console.log(`    ${symbol} -> 状态${target.id}`);
        }
      }
    }
  }
}
