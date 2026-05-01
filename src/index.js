/**
 * 编译原理课程设计 - 主入口
 * 支持词法分析、LR(1)语法分析、语义分析
 */

import { Lexer, formatTokenTable, tokensToJSON } from './lexer/lexer.js';
import { Parser, runParser } from './parser/parser.js';
import { SemanticAnalyzer, runSemanticAnalyzer } from './semantic/semantic.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// 默认文件路径
const DEFAULT_PATHS = {
  lexGrammar: join(ROOT_DIR, 'input', 'lex-grammar.txt'),
  syntaxGrammar: join(ROOT_DIR, 'input', 'syntax-grammar.txt'),
  semanticGrammar: join(ROOT_DIR, 'input', 'semantic-grammar.txt'),
  source: join(ROOT_DIR, 'input', 'source.txt'),
  output: join(ROOT_DIR, 'output')
};

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
编译原理课程设计 - 词法分析、LR(1)语法分析、语义分析

用法:
  node src/index.js [选项] [参数...]

选项:
  --lex                    仅执行词法分析
  --parse                  执行词法分析和语法分析
  --semantic               执行完整的词法、语法、语义分析
  --tables                 打印LR(1)分析表
  --items                  打印LR(1)项目集规范族
  --help                   显示此帮助信息

参数:
  --lex-grammar <file>     词法文法文件 (默认: input/lex-grammar.txt)
  --syntax-grammar <file>  语法文法文件 (默认: input/syntax-grammar.txt)
  --semantic-grammar <file> 语义文法文件 (默认: input/semantic-grammar.txt)
  --source <file>          源代码文件 (默认: input/source.txt)
  --output <dir>           输出目录 (默认: output/)

示例:
  node src/index.js --lex
  node src/index.js --parse --source input/test.txt
  node src/index.js --semantic
  node src/index.js --tables
  `);
}

/**
 * 解析命令行参数
 */
function parseArgs(args) {
  const options = {
    mode: 'help',
    lexGrammar: DEFAULT_PATHS.lexGrammar,
    syntaxGrammar: DEFAULT_PATHS.syntaxGrammar,
    semanticGrammar: DEFAULT_PATHS.semanticGrammar,
    source: DEFAULT_PATHS.source,
    output: DEFAULT_PATHS.output,
    showTables: false,
    showItems: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--lex':
        options.mode = 'lex';
        break;
      case '--parse':
        options.mode = 'parse';
        break;
      case '--semantic':
        options.mode = 'semantic';
        break;
      case '--tables':
        options.showTables = true;
        if (options.mode === 'help') options.mode = 'parse';
        break;
      case '--items':
        options.showItems = true;
        if (options.mode === 'help') options.mode = 'parse';
        break;
      case '--lex-grammar':
        options.lexGrammar = args[++i];
        break;
      case '--syntax-grammar':
        options.syntaxGrammar = args[++i];
        break;
      case '--semantic-grammar':
        options.semanticGrammar = args[++i];
        break;
      case '--source':
        options.source = args[++i];
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--help':
      case '-h':
        options.mode = 'help';
        break;
    }
  }

  return options;
}

/**
 * 执行词法分析
 */
function runLexicalAnalysis(options) {
  console.log('\n' + '='.repeat(60));
  console.log('词法分析');
  console.log('='.repeat(60));

  if (!existsSync(options.lexGrammar)) {
    console.error(`错误: 词法文法文件不存在: ${options.lexGrammar}`);
    return null;
  }

  if (!existsSync(options.source)) {
    console.error(`错误: 源代码文件不存在: ${options.source}`);
    return null;
  }

  try {
    const lexer = new Lexer(options.lexGrammar);
    const sourceCode = readFileSync(options.source, 'utf-8');

    console.log(`\n源代码:\n${sourceCode}`);
    console.log('\n正在分析...');

    const tokens = lexer.analyze(sourceCode);

    console.log('\n分析结果:');
    console.log(formatTokenTable(tokens));

    // 保存token表
    const tokenFile = join(options.output, 'tokens.json');
    writeFileSync(tokenFile, tokensToJSON(tokens), 'utf-8');
    console.log(`\nToken表已保存到: ${tokenFile}`);

    return tokens;

  } catch (error) {
    console.error('词法分析错误:', error.message);
    return null;
  }
}

/**
 * 执行语法分析
 */
function runSyntaxAnalysis(options) {
  console.log('\n' + '='.repeat(60));
  console.log('语法分析 (LR(1))');
  console.log('='.repeat(60));

  if (!existsSync(options.syntaxGrammar)) {
    console.error(`错误: 语法文法文件不存在: ${options.syntaxGrammar}`);
    return null;
  }

  try {
    const parser = new Parser(options.lexGrammar, options.syntaxGrammar);

    // 打印分析表
    if (options.showTables) {
      parser.printTables();
    }

    // 打印项目集
    if (options.showItems) {
      parser.printItemSets();
    }

    console.log(`\n正在分析源文件: ${options.source}`);
    const result = parser.analyze(options.source);

    console.log(parser.formatResult(result));

    // 保存结果
    const resultFile = join(options.output, 'parse-result.txt');
    parser.saveResult(result, resultFile);

    return result;

  } catch (error) {
    console.error('语法分析错误:', error.message);
    console.error(error.stack);
    return null;
  }
}

/**
 * 执行语义分析
 */
function runSemantic(options) {
  console.log('\n' + '='.repeat(60));
  console.log('语义分析');
  console.log('='.repeat(60));

  if (!existsSync(options.semanticGrammar)) {
    console.error(`错误: 语义文法文件不存在: ${options.semanticGrammar}`);
    return null;
  }

  try {
    const analyzer = new SemanticAnalyzer(
      options.lexGrammar,
      options.syntaxGrammar,
      options.semanticGrammar
    );

    console.log(`\n正在分析源文件: ${options.source}`);
    const sourceCode = readFileSync(options.source, 'utf-8');
    const result = analyzer.analyze(sourceCode);

    console.log(analyzer.formatResult(result));

    // 保存结果
    const resultFile = join(options.output, 'semantic-result.txt');
    writeFileSync(resultFile, analyzer.formatResult(result), 'utf-8');
    console.log(`\n语义分析结果已保存到: ${resultFile}`);

    return result;

  } catch (error) {
    console.error('语义分析错误:', error.message);
    console.error(error.stack);
    return null;
  }
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  // 确保输出目录存在
  if (!existsSync(options.output)) {
    mkdirSync(options.output, { recursive: true });
  }

  switch (options.mode) {
    case 'help':
      showHelp();
      break;

    case 'lex':
      runLexicalAnalysis(options);
      break;

    case 'parse':
      runLexicalAnalysis(options);
      runSyntaxAnalysis(options);
      break;

    case 'semantic':
      runLexicalAnalysis(options);
      runSyntaxAnalysis(options);
      runSemantic(options);
      break;

    default:
      showHelp();
  }
}

// 运行主函数
main();
