/**
 * 语法分析器主模块
 * 整合词法分析和LR(1)语法分析
 */

import { LR1Parser } from './lr1.js';
import { Lexer, formatTokenTable, tokensToJSON } from '../lexer/lexer.js';
import { readFileSync, writeFileSync } from 'fs';

/**
 * 语法分析器类
 */
export class Parser {
  constructor(lexerGrammarFile, parserGrammarFile) {
    this.lexer = new Lexer(lexerGrammarFile);
    this.lr1Parser = new LR1Parser(parserGrammarFile);
  }

  /**
   * 执行完整的编译过程：词法分析 + 语法分析
   * @param {string} sourceFile - 源代码文件路径
   * @returns {Object} - 分析结果
   */
  analyze(sourceFile) {
    const sourceCode = readFileSync(sourceFile, 'utf-8');
    return this.analyzeSource(sourceCode);
  }

  /**
   * 分析源代码字符串
   * @param {string} sourceCode - 源代码字符串
   * @returns {Object} - 分析结果
   */
  analyzeSource(sourceCode) {
    // 词法分析
    const tokens = this.lexer.analyze(sourceCode);

    // 检查词法错误
    const lexErrors = tokens.filter(t => t.type === 'ERROR');
    if (lexErrors.length > 0) {
      return {
        success: false,
        phase: 'lexical',
        tokens: tokens,
        errors: lexErrors.map(e => ({
          line: e.line,
          message: `无法识别的字符: '${e.value}'`
        }))
      };
    }

    // 语法分析
    const parseResult = this.lr1Parser.parse(tokens);

    return {
      success: parseResult.success,
      phase: 'syntax',
      tokens: tokens,
      steps: parseResult.steps,
      error: parseResult.error
    };
  }

  /**
   * 格式化分析过程
   * @param {Object} result - 分析结果
   * @returns {string} - 格式化的字符串
   */
  formatResult(result) {
    let output = '';

    // 词法分析结果
    output += '\n===== 词法分析结果 =====\n';
    output += formatTokenTable(result.tokens);
    output += '\n';

    if (result.phase === 'lexical') {
      output += '\n===== 词法错误 =====\n';
      for (const error of result.errors) {
        output += `第${error.line}行: ${error.message}\n`;
      }
      return output;
    }

    // 语法分析过程
    if (result.steps) {
      output += '\n===== 语法分析过程 =====\n';
      output += '步骤\t\t栈\t\t\t\t\t输入\t\t\t\t动作\n';
      output += '='.repeat(100) + '\n';

      for (const step of result.steps) {
        output += `${step.step}\t\t${step.stack}\t\t\t${step.input}\t\t\t${step.action}\n`;
      }
    }

    // 分析结果
    output += '\n===== 分析结果 =====\n';
    if (result.success) {
      output += 'YES - 源代码符合文法规则\n';
    } else {
      output += 'NO - 源代码不符合文法规则\n';
      if (result.error) {
        output += `错误位置: 第${result.error.line}行\n`;
        output += `错误信息: ${result.error.message}\n`;
      }
    }

    return output;
  }

  /**
   * 打印LR(1)分析表
   */
  printTables() {
    this.lr1Parser.printTables();
  }

  /**
   * 打印项目集规范族
   */
  printItemSets() {
    this.lr1Parser.printItemSets();
  }

  /**
   * 保存token表到文件
   */
  saveTokens(tokens, outputFile) {
    const content = tokensToJSON(tokens);
    writeFileSync(outputFile, content, 'utf-8');
    console.log(`Token表已保存到: ${outputFile}`);
  }

  /**
   * 保存分析结果到文件
   */
  saveResult(result, outputFile) {
    const content = this.formatResult(result);
    writeFileSync(outputFile, content, 'utf-8');
    console.log(`分析结果已保存到: ${outputFile}`);
  }
}

/**
 * 命令行入口
 */
export function runParser(args) {
  if (args.length < 3) {
    console.log('用法: node parser.js <词法文法文件> <语法文法文件> <源代码文件> [输出文件]');
    console.log('示例: node parser.js input/lex-grammar.txt input/syntax-grammar.txt input/source.txt');
    return;
  }

  const [lexGrammarFile, syntaxGrammarFile, sourceFile, outputFile] = args;

  try {
    console.log('正在初始化分析器...');
    const parser = new Parser(lexGrammarFile, syntaxGrammarFile);

    console.log(`正在分析源文件: ${sourceFile}`);
    const result = parser.analyze(sourceFile);

    // 输出结果
    const formattedResult = parser.formatResult(result);
    console.log(formattedResult);

    // 保存结果
    if (outputFile) {
      parser.saveResult(result, outputFile);
    }

    // 保存token表
    const tokenFile = sourceFile.replace(/\.\w+$/, '-tokens.json');
    parser.saveTokens(result.tokens, tokenFile);

    return result;

  } catch (error) {
    console.error('错误:', error.message);
    console.error(error.stack);
  }
}

// 如果直接运行此文件
if (process.argv[1] && process.argv[1].endsWith('parser.js')) {
  runParser(process.argv.slice(2));
}
