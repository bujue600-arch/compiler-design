/**
 * 词法分析器主模块
 * 负责读取正规文法，构建NFA/DFA，识别token
 */

import { buildNFAFromGrammar } from './nfa.js';
import { subsetConstruction } from './dfa.js';
import { readFileSync } from 'fs';

// Token类型定义
export const TokenType = {
  KEYWORD: 'KEYWORD',
  IDENTIFIER: 'IDENTIFIER',
  CONSTANT: 'CONSTANT',
  DELIMITER: 'DELIMITER',
  OPERATOR: 'OPERATOR'
};

// 关键字列表
const KEYWORDS = new Set([
  'int', 'float', 'double', 'char', 'void', 'bool',
  'if', 'else', 'while', 'for', 'do', 'switch', 'case', 'default',
  'break', 'continue', 'return', 'struct', 'class', 'const',
  'true', 'false', 'null', 'var', 'let', 'function'
]);

// 运算符
const OPERATORS = new Set([
  '+', '-', '*', '/', '%', '=', '==', '!=', '<', '>', '<=', '>=',
  '&&', '||', '!', '&', '|', '^', '~', '<<', '>>', '++', '--',
  '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=',
  '->', '.', '?', ':'
]);

// 界符
const DELIMITERS = new Set([
  '(', ')', '[', ']', '{', '}', ';', ',', '#', '"', "'", '`'
]);

/**
 * 词法分析器类
 */
export class Lexer {
  constructor(grammarFile) {
    this.grammars = this.parseGrammarFile(grammarFile);
    this.dfas = new Map();
    this.buildDFAs();
  }

  /**
   * 解析正规文法文件
   * 文件格式：
   * # 词法规则名称
   * A -> aB | a | ε
   */
  parseGrammarFile(filePath) {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));

    const grammars = [];
    let currentGrammar = null;

    for (const line of lines) {
      if (line.startsWith('#')) {
        // 新的规则名称
        if (currentGrammar) {
          grammars.push(currentGrammar);
        }
        currentGrammar = {
          name: line.substring(1).trim(),
          rules: []
        };
      } else if (line.includes('->') && currentGrammar) {
        // 产生式
        const [left, rightStr] = line.split('->').map(s => s.trim());
        const right = rightStr.split('|').map(s => s.trim());
        currentGrammar.rules.push({ left, right });
      }
    }

    if (currentGrammar) {
      grammars.push(currentGrammar);
    }

    return grammars;
  }

  /**
   * 为每个正规文法构建DFA
   */
  buildDFAs() {
    for (const grammar of this.grammars) {
      const nfa = buildNFAFromGrammar(grammar.rules);
      const dfa = subsetConstruction(nfa, grammar.name);
      this.dfas.set(grammar.name, dfa);
    }
  }

  /**
   * 对源代码进行词法分析
   * @param {string} sourceCode - 源代码字符串
   * @returns {Array} - token列表
   */
  analyze(sourceCode) {
    const tokens = [];
    const lines = sourceCode.split('\n');

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      let pos = 0;

      while (pos < line.length) {
        // 跳过空白字符
        if (/\s/.test(line[pos])) {
          pos++;
          continue;
        }

        // 跳过注释
        if (line[pos] === '/' && line[pos + 1] === '/') {
          break; // 单行注释，跳过本行剩余部分
        }

        if (line[pos] === '/' && line[pos + 1] === '*') {
          // 多行注释开始
          pos += 2;
          while (pos < line.length - 1) {
            if (line[pos] === '*' && line[pos + 1] === '/') {
              pos += 2;
              break;
            }
            pos++;
          }
          continue;
        }

        // 尝试识别token
        const token = this.recognizeToken(line, pos, lineNum + 1);
        if (token) {
          tokens.push(token);
          pos += token.value.length;
        } else {
          // 无法识别的字符
          tokens.push({
            line: lineNum + 1,
            type: 'ERROR',
            value: line[pos]
          });
          pos++;
        }
      }
    }

    return tokens;
  }

  /**
   * 从指定位置识别一个token
   */
  recognizeToken(line, pos, lineNum) {
    // 尝试识别数字常量（包括科学计数法和复数）
    const numberToken = this.recognizeNumber(line, pos, lineNum);
    if (numberToken) return numberToken;

    // 尝试识别标识符或关键字
    const idToken = this.recognizeIdentifier(line, pos, lineNum);
    if (idToken) return idToken;

    // 尝试识别运算符
    const opToken = this.recognizeOperator(line, pos, lineNum);
    if (opToken) return opToken;

    // 尝试识别界符
    const delimToken = this.recognizeDelimiter(line, pos, lineNum);
    if (delimToken) return delimToken;

    // 尝试识别字符串常量
    const strToken = this.recognizeString(line, pos, lineNum);
    if (strToken) return strToken;

    return null;
  }

  /**
   * 识别数字常量
   * 支持：整数、浮点数、科学计数法（如0.314E+1）、复数（如10+12i）
   */
  recognizeNumber(line, pos, lineNum) {
    let i = pos;
    let value = '';
    let hasDecimal = false;
    let hasExponent = false;
    let isComplex = false;

    // 读取整数部分
    while (i < line.length && /\d/.test(line[i])) {
      value += line[i];
      i++;
    }

    // 检查小数点
    if (i < line.length && line[i] === '.') {
      hasDecimal = true;
      value += '.';
      i++;

      // 读取小数部分
      while (i < line.length && /\d/.test(line[i])) {
        value += line[i];
        i++;
      }
    }

    // 检查科学计数法
    if (i < line.length && (line[i] === 'E' || line[i] === 'e')) {
      hasExponent = true;
      value += line[i];
      i++;

      // 检查指数符号
      if (i < line.length && (line[i] === '+' || line[i] === '-')) {
        value += line[i];
        i++;
      }

      // 读取指数
      while (i < line.length && /\d/.test(line[i])) {
        value += line[i];
        i++;
      }
    }

    // 检查复数（如10+12i 或 3i）
    if (i < line.length && line[i] === 'i') {
      isComplex = true;
      value += 'i';
      i++;
    } else if (i < line.length && (line[i] === '+' || line[i] === '-') && i + 1 < line.length && /\d/.test(line[i + 1])) {
      // 可能是复数的虚部，如 10+12i
      const savedPos = i;
      const savedValue = value;

      // 检查后面是否有 i
      let j = i;
      let complexPart = '';
      complexPart += line[j]; // + 或 -
      j++;

      while (j < line.length && /\d/.test(line[j])) {
        complexPart += line[j];
        j++;
      }

      if (j < line.length && line[j] === 'i') {
        isComplex = true;
        value += complexPart + 'i';
        i = j + 1;
      } else {
        // 不是复数，回退
        i = savedPos;
        value = savedValue;
      }
    }

    // 如果识别到数字
    if (value.length > 0 && (/\d/.test(value[0]))) {
      // 检查是否紧跟字母（非法标识符）
      if (i < line.length && /[a-zA-Z_]/.test(line[i]) && !isComplex) {
        return null;
      }

      return {
        line: lineNum,
        type: TokenType.CONSTANT,
        value: value
      };
    }

    return null;
  }

  /**
   * 识别标识符或关键字
   * 规则：以字母或下划线开头，后跟字母、数字或下划线
   */
  recognizeIdentifier(line, pos, lineNum) {
    if (!/[a-zA-Z_]/.test(line[pos])) {
      return null;
    }

    let i = pos;
    let value = '';

    while (i < line.length && /[a-zA-Z0-9_]/.test(line[i])) {
      value += line[i];
      i++;
    }

    // 检查是否为关键字
    const type = KEYWORDS.has(value) ? TokenType.KEYWORD : TokenType.IDENTIFIER;

    return {
      line: lineNum,
      type: type,
      value: value
    };
  }

  /**
   * 识别运算符
   */
  recognizeOperator(line, pos, lineNum) {
    // 尝试匹配最长的运算符
    for (let len = 3; len >= 1; len--) {
      if (pos + len <= line.length) {
        const substr = line.substring(pos, pos + len);
        if (OPERATORS.has(substr)) {
          return {
            line: lineNum,
            type: TokenType.OPERATOR,
            value: substr
          };
        }
      }
    }
    return null;
  }

  /**
   * 识别界符
   */
  recognizeDelimiter(line, pos, lineNum) {
    if (DELIMITERS.has(line[pos])) {
      return {
        line: lineNum,
        type: TokenType.DELIMITER,
        value: line[pos]
      };
    }
    return null;
  }

  /**
   * 识别字符串常量
   */
  recognizeString(line, pos, lineNum) {
    if (line[pos] !== '"') return null;

    let i = pos + 1;
    let value = '"';

    while (i < line.length && line[i] !== '"') {
      if (line[i] === '\\') {
        value += line[i];
        i++;
        if (i < line.length) {
          value += line[i];
          i++;
        }
      } else {
        value += line[i];
        i++;
      }
    }

    if (i < line.length && line[i] === '"') {
      value += '"';
      return {
        line: lineNum,
        type: TokenType.CONSTANT,
        value: value
      };
    }

    return null;
  }
}

/**
 * 格式化token列表为表格
 */
export function formatTokenTable(tokens) {
  const header = '行号\t\t类型\t\t\t内容';
  const separator = '='.repeat(50);

  const rows = tokens.map(token => {
    return `${token.line}\t\t${token.type}\t\t${token.value}`;
  });

  return [separator, header, separator, ...rows, separator].join('\n');
}

/**
 * 将token列表保存为JSON格式
 */
export function tokensToJSON(tokens) {
  return JSON.stringify(tokens, null, 2);
}
