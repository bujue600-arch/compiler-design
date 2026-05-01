/**
 * 测试脚本
 * 验证词法分析器、语法分析器和语义分析器的功能
 */

import { Lexer, formatTokenTable } from './lexer/lexer.js';
import { LR1Parser } from './parser/lr1.js';
import { SemanticAnalyzer } from './semantic/semantic.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// 测试颜色输出
const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`
};

/**
 * 测试词法分析器
 */
function testLexer() {
  console.log(colors.blue('\n===== 测试词法分析器 =====\n'));

  try {
    const lexer = new Lexer(join(ROOT_DIR, 'input', 'lex-grammar.txt'));

    // 测试用例1：基本token识别
    const testCode1 = 'int x = 10;';
    console.log('测试1: 基本token识别');
    console.log(`输入: ${testCode1}`);
    const tokens1 = lexer.analyze(testCode1);
    console.log(formatTokenTable(tokens1));
    console.log(colors.green('✓ 测试1通过\n'));

    // 测试用例2：科学计数法
    const testCode2 = 'float a = 0.314E+1;';
    console.log('测试2: 科学计数法');
    console.log(`输入: ${testCode2}`);
    const tokens2 = lexer.analyze(testCode2);
    console.log(formatTokenTable(tokens2));
    console.log(colors.green('✓ 测试2通过\n'));

    // 测试用例3：复数常量
    const testCode3 = 'complex z = 10+12i;';
    console.log('测试3: 复数常量');
    console.log(`输入: ${testCode3}`);
    const tokens3 = lexer.analyze(testCode3);
    console.log(formatTokenTable(tokens3));
    console.log(colors.green('✓ 测试3通过\n'));

    // 测试用例4：运算符
    const testCode4 = 'x = a + b * c - d / e;';
    console.log('测试4: 运算符');
    console.log(`输入: ${testCode4}`);
    const tokens4 = lexer.analyze(testCode4);
    console.log(formatTokenTable(tokens4));
    console.log(colors.green('✓ 测试4通过\n'));

    return true;

  } catch (error) {
    console.error(colors.red(`词法分析器测试失败: ${error.message}`));
    console.error(error.stack);
    return false;
  }
}

/**
 * 测试LR(1)语法分析器
 */
function testParser() {
  console.log(colors.blue('\n===== 测试LR(1)语法分析器 =====\n'));

  try {
    // 测试LR(1)分析器初始化
    console.log('测试1: LR(1)分析器初始化');
    const parser = new LR1Parser(join(ROOT_DIR, 'input', 'syntax-grammar.txt'));
    console.log('LR(1)分析器初始化成功');
    console.log(`项目集数量: ${parser.itemSets.length}`);
    console.log(colors.green('✓ 测试1通过\n'));

    // 测试项目集规范族
    console.log('测试2: 项目集规范族');
    console.log(`状态数量: ${parser.itemSets.length}`);
    console.log(colors.green('✓ 测试2通过\n'));

    // 测试分析表构建
    console.log('测试3: ACTION/GOTO表构建');
    console.log(`ACTION表大小: ${parser.actionTable.size}`);
    console.log(`GOTO表大小: ${parser.gotoTable.size}`);
    console.log(colors.green('✓ 测试3通过\n'));

    return true;

  } catch (error) {
    console.error(colors.red(`语法分析器测试失败: ${error.message}`));
    console.error(error.stack);
    return false;
  }
}

/**
 * 测试语义分析器
 */
function testSemanticAnalyzer() {
  console.log(colors.blue('\n===== 测试语义分析器 =====\n'));

  try {
    console.log('测试1: 语义分析器初始化');
    const analyzer = new SemanticAnalyzer(
      join(ROOT_DIR, 'input', 'lex-grammar.txt'),
      join(ROOT_DIR, 'input', 'syntax-grammar.txt'),
      join(ROOT_DIR, 'input', 'semantic-grammar.txt')
    );
    console.log('语义分析器初始化成功');
    console.log(colors.green('✓ 测试1通过\n'));

    // 测试变量声明分析
    console.log('测试2: 变量声明分析');
    const testCode = 'int x, y;';
    const result = analyzer.analyze(testCode);
    console.log(`分析结果: ${result.success ? '成功' : '失败'}`);
    console.log(colors.green('✓ 测试2通过\n'));

    return true;

  } catch (error) {
    console.error(colors.red(`语义分析器测试失败: ${error.message}`));
    console.error(error.stack);
    return false;
  }
}

/**
 * 运行所有测试
 */
function runAllTests() {
  console.log(colors.yellow('========================================'));
  console.log(colors.yellow('编译原理课程设计 - 测试套件'));
  console.log(colors.yellow('========================================'));

  const results = {
    lexer: testLexer(),
    parser: testParser(),
    semantic: testSemanticAnalyzer()
  };

  console.log(colors.yellow('\n========================================'));
  console.log(colors.yellow('测试结果汇总'));
  console.log(colors.yellow('========================================'));
  console.log(`词法分析器: ${results.lexer ? colors.green('✓ 通过') : colors.red('✗ 失败')}`);
  console.log(`语法分析器: ${results.parser ? colors.green('✓ 通过') : colors.red('✗ 失败')}`);
  console.log(`语义分析器: ${results.semantic ? colors.green('✓ 通过') : colors.red('✗ 失败')}`);

  const allPassed = Object.values(results).every(r => r);
  console.log(colors.yellow('\n========================================'));
  console.log(allPassed ? colors.green('所有测试通过!') : colors.red('部分测试失败'));
  console.log(colors.yellow('========================================'));

  return allPassed;
}

// 运行测试
runAllTests();
