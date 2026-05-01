/**
 * 语义分析器
 * 实现属性文法和语义规则
 * 支持表达式计算、类型检查等基本语义分析
 */

import { readFileSync } from 'fs';
import { LR1Parser } from '../parser/lr1.js';
import { Lexer, formatTokenTable } from '../lexer/lexer.js';

// 属性类型
export const AttrType = {
  SYNTHESIZED: 'synthesized',  // 综合属性（自下而上传递）
  INHERITED: 'inherited'       // 继承属性（自上而下传递）
};

// 语义动作
export class SemanticAction {
  constructor(name, params, body) {
    this.name = name;
    this.params = params;
    this.body = body;
  }

  execute(context) {
    try {
      // 创建函数并执行
      const func = new Function(...this.params, this.body);
      return func(...this.params.map(p => context[p]));
    } catch (error) {
      console.error(`语义动作 ${this.name} 执行错误:`, error.message);
      return null;
    }
  }
}

// 符号表项
export class SymbolTableEntry {
  constructor(name, type, value = null, line = 0) {
    this.name = name;
    this.type = type;
    this.value = value;
    this.line = line;
    this.attributes = new Map();
  }

  setAttribute(key, value) {
    this.attributes.set(key, value);
  }

  getAttribute(key) {
    return this.attributes.get(key);
  }
}

// 符号表
export class SymbolTable {
  constructor(parent = null) {
    this.symbols = new Map();
    this.parent = parent;
  }

  // 查找符号（包括父作用域）
  lookup(name) {
    if (this.symbols.has(name)) {
      return this.symbols.get(name);
    }
    if (this.parent) {
      return this.parent.lookup(name);
    }
    return null;
  }

  // 在当前作用域定义符号
  define(entry) {
    if (this.symbols.has(entry.name)) {
      return {
        success: false,
        error: `变量 '${entry.name}' 已在第${this.symbols.get(entry.name).line}行定义`
      };
    }
    this.symbols.set(entry.name, entry);
    return { success: true };
  }

  // 更新符号
  update(name, value) {
    const entry = this.lookup(name);
    if (!entry) {
      return {
        success: false,
        error: `变量 '${name}' 未定义`
      };
    }
    entry.value = value;
    return { success: true };
  }

  // 创建子作用域
  createChildScope() {
    return new SymbolTable(this);
  }

  // 获取所有符号
  getAllSymbols() {
    const result = [];
    for (const [name, entry] of this.symbols) {
      result.push({ name, ...entry });
    }
    if (this.parent) {
      result.push(...this.parent.getAllSymbols());
    }
    return result;
  }
}

/**
 * 语义分析器类
 */
export class SemanticAnalyzer {
  constructor(lexerGrammarFile, grammarFile, semanticGrammarFile) {
    this.lexer = new Lexer(lexerGrammarFile);
    this.parser = new LR1Parser(grammarFile);
    this.semanticRules = this.parseSemanticGrammar(semanticGrammarFile);
    this.symbolTable = new SymbolTable();
    this.errors = [];
    this.warnings = [];
    this.intermediateCode = [];
  }

  /**
   * 解析语义文法文件
   * 格式：
   * 产生式 { 语义动作 }
   * E -> E + T { E.val = E1.val + T.val }
   */
  parseSemanticGrammar(filePath) {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));

    const rules = new Map();

    for (const line of lines) {
      // 解析产生式和语义动作
      const match = line.match(/^(\w+)\s*->\s*(.*?)(?:\{(.*)\})?$/);
      if (match) {
        const left = match[1];
        const right = match[2].trim().split(/\s+/);
        const action = match[3] ? match[3].trim() : null;

        const key = `${left} -> ${right.join(' ')}`;
        rules.set(key, {
          left,
          right,
          action: action ? this.parseAction(action) : null
        });
      }
    }

    return rules;
  }

  /**
   * 解析语义动作
   */
  parseAction(actionStr) {
    // 简单的动作解析，如 E.val = E1.val + T.val
    const assignments = actionStr.split(';').filter(a => a.trim());

    return assignments.map(assignment => {
      const match = assignment.trim().match(/(\w+)\.(\w+)\s*=\s*(.+)/);
      if (match) {
        return {
          target: { symbol: match[1], attr: match[2] },
          expression: match[3].trim()
        };
      }
      return null;
    }).filter(a => a);
  }

  /**
   * 执行语义分析
   * @param {string} sourceCode - 源代码
   * @returns {Object} - 分析结果
   */
  analyze(sourceCode) {
    // 词法分析
    const tokens = this.lexer.analyze(sourceCode);

    // 检查词法错误
    const lexErrors = tokens.filter(t => t.type === 'ERROR');
    if (lexErrors.length > 0) {
      return {
        success: false,
        phase: 'lexical',
        tokens,
        errors: lexErrors.map(e => ({
          line: e.line,
          message: `无法识别的字符: '${e.value}'`
        }))
      };
    }

    // 语法分析
    const parseResult = this.parser.parse(tokens);
    if (!parseResult.success) {
      return {
        success: false,
        phase: 'syntax',
        tokens,
        steps: parseResult.steps,
        error: parseResult.error
      };
    }

    // 语义分析
    const semanticResult = this.performSemanticAnalysis(tokens, parseResult);

    return {
      success: this.errors.length === 0,
      phase: 'semantic',
      tokens,
      steps: parseResult.steps,
      symbolTable: this.symbolTable,
      intermediateCode: this.intermediateCode,
      errors: this.errors,
      warnings: this.warnings,
      result: semanticResult
    };
  }

  /**
   * 执行语义分析
   */
  performSemanticAnalysis(tokens, parseResult) {
    // 初始化符号表
    this.symbolTable = new SymbolTable();
    this.errors = [];
    this.warnings = [];
    this.intermediateCode = [];

    // 遍历token进行语义分析
    let i = 0;
    while (i < tokens.length) {
      const token = tokens[i];

      // 处理变量声明
      if (token.type === 'KEYWORD' && ['int', 'float', 'double', 'var', 'let'].includes(token.value)) {
        i = this.processDeclaration(tokens, i);
      }
      // 处理赋值语句
      else if (token.type === 'IDENTIFIER' && i + 1 < tokens.length && tokens[i + 1].value === '=') {
        i = this.processAssignment(tokens, i);
      }
      // 处理表达式
      else if (token.type === 'IDENTIFIER' || token.type === 'CONSTANT' || token.value === '(') {
        const result = this.evaluateExpression(tokens, i);
        if (result.value !== undefined) {
          this.intermediateCode.push(`表达式结果: ${result.value}`);
        }
        i = result.nextIndex;
      }
      else {
        i++;
      }
    }

    return {
      symbolTable: this.symbolTable,
      intermediateCode: this.intermediateCode
    };
  }

  /**
   * 处理变量声明
   */
  processDeclaration(tokens, startIndex) {
    let i = startIndex;
    const type = tokens[i].value;
    i++;

    while (i < tokens.length && tokens[i].type === 'IDENTIFIER') {
      const name = tokens[i].value;
      const line = tokens[i].line;

      // 检查是否已定义
      const existing = this.symbolTable.lookup(name);
      if (existing) {
        this.errors.push({
          line,
          message: `变量 '${name}' 已在第${existing.line}行定义`
        });
      } else {
        // 定义变量
        const entry = new SymbolTableEntry(name, type, null, line);
        const result = this.symbolTable.define(entry);

        if (!result.success) {
          this.errors.push({
            line,
            message: result.error
          });
        }

        this.intermediateCode.push(`声明变量: ${type} ${name}`);
      }

      i++;

      // 检查是否有初始化
      if (i < tokens.length && tokens[i].value === '=') {
        i++;
        const exprResult = this.evaluateExpression(tokens, i);
        if (exprResult.value !== undefined) {
          this.symbolTable.update(name, exprResult.value);
          this.intermediateCode.push(`${name} = ${exprResult.value}`);
        }
        i = exprResult.nextIndex;
      }

      // 检查逗号
      if (i < tokens.length && tokens[i].value === ',') {
        i++;
      } else {
        break;
      }
    }

    // 跳过分号
    if (i < tokens.length && tokens[i].value === ';') {
      i++;
    }

    return i;
  }

  /**
   * 处理赋值语句
   */
  processAssignment(tokens, startIndex) {
    let i = startIndex;
    const name = tokens[i].value;
    const line = tokens[i].line;

    // 检查变量是否已定义
    const entry = this.symbolTable.lookup(name);
    if (!entry) {
      this.errors.push({
        line,
        message: `变量 '${name}' 未定义`
      });
      // 跳到分号
      while (i < tokens.length && tokens[i].value !== ';') i++;
      return i + 1;
    }

    i += 2; // 跳过变量名和 =

    // 计算表达式
    const exprResult = this.evaluateExpression(tokens, i);
    if (exprResult.value !== undefined) {
      // 类型检查
      const valueType = this.getValueType(exprResult.value);
      if (!this.isTypeCompatible(entry.type, valueType)) {
        this.warnings.push({
          line,
          message: `类型不兼容: 不能将 ${valueType} 赋值给 ${entry.type}`
        });
      }

      this.symbolTable.update(name, exprResult.value);
      this.intermediateCode.push(`${name} = ${exprResult.value}`);
    }

    // 跳过分号
    i = exprResult.nextIndex;
    if (i < tokens.length && tokens[i].value === ';') {
      i++;
    }

    return i;
  }

  /**
   * 计算表达式
   * 支持基本的算术运算
   */
  evaluateExpression(tokens, startIndex) {
    let i = startIndex;
    let result = 0;
    let operator = '+';
    let firstTerm = true;

    while (i < tokens.length) {
      const token = tokens[i];

      // 遇到分号、逗号或右括号结束
      if (token.value === ';' || token.value === ',' || token.value === ')') {
        break;
      }

      // 处理运算符
      if (['+', '-', '*', '/'].includes(token.value)) {
        operator = token.value;
        i++;
        continue;
      }

      // 处理操作数
      let operand;
      if (token.type === 'IDENTIFIER') {
        const entry = this.symbolTable.lookup(token.value);
        if (!entry) {
          this.errors.push({
            line: token.line,
            message: `变量 '${token.value}' 未定义`
          });
          return { value: undefined, nextIndex: i + 1 };
        }
        operand = entry.value;
        if (operand === null || operand === undefined) {
          this.warnings.push({
            line: token.line,
            message: `变量 '${token.value}' 未初始化`
          });
          operand = 0;
        }
      } else if (token.type === 'CONSTANT') {
        operand = parseFloat(token.value);
      } else if (token.value === '(') {
        // 递归计算括号内的表达式
        const subResult = this.evaluateExpression(tokens, i + 1);
        operand = subResult.value;
        i = subResult.nextIndex;
        if (i < tokens.length && tokens[i].value === ')') {
          i++;
        }
      } else {
        i++;
        continue;
      }

      // 应用运算
      if (firstTerm) {
        result = operand;
        firstTerm = false;
      } else {
        switch (operator) {
          case '+': result += operand; break;
          case '-': result -= operand; break;
          case '*': result *= operand; break;
          case '/':
            if (operand === 0) {
              this.errors.push({
                line: token.line,
                message: '除零错误'
              });
              return { value: undefined, nextIndex: i + 1 };
            }
            result /= operand;
            break;
        }
      }

      i++;
    }

    return { value: result, nextIndex: i };
  }

  /**
   * 获取值的类型
   */
  getValueType(value) {
    if (Number.isInteger(value)) return 'int';
    if (typeof value === 'number') return 'float';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'boolean') return 'bool';
    return 'unknown';
  }

  /**
   * 检查类型兼容性
   */
  isTypeCompatible(targetType, sourceType) {
    // 简单的类型兼容性检查
    const numericTypes = ['int', 'float', 'double'];
    if (numericTypes.includes(targetType) && numericTypes.includes(sourceType)) {
      return true;
    }
    return targetType === sourceType;
  }

  /**
   * 格式化分析结果
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

    if (result.phase === 'syntax') {
      output += '\n===== 语法分析结果 =====\n';
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

    // 语义分析结果
    output += '\n===== 语义分析结果 =====\n';

    // 符号表
    output += '\n----- 符号表 -----\n';
    output += '名称\t\t类型\t\t值\t\t行号\n';
    output += '-'.repeat(50) + '\n';

    if (result.symbolTable) {
      const symbols = result.symbolTable.getAllSymbols();
      const uniqueSymbols = new Map();
      for (const sym of symbols) {
        if (!uniqueSymbols.has(sym.name)) {
          uniqueSymbols.set(sym.name, sym);
        }
      }
      for (const [name, sym] of uniqueSymbols) {
        output += `${name}\t\t${sym.type}\t\t${sym.value ?? 'null'}\t\t${sym.line}\n`;
      }
    }

    // 中间代码
    if (result.intermediateCode && result.intermediateCode.length > 0) {
      output += '\n----- 中间代码 -----\n';
      for (const code of result.intermediateCode) {
        output += `${code}\n`;
      }
    }

    // 语义错误
    if (result.errors && result.errors.length > 0) {
      output += '\n----- 语义错误 -----\n';
      for (const error of result.errors) {
        output += `第${error.line}行: ${error.message}\n`;
      }
    }

    // 语义警告
    if (result.warnings && result.warnings.length > 0) {
      output += '\n----- 语义警告 -----\n';
      for (const warning of result.warnings) {
        output += `第${warning.line}行: ${warning.message}\n`;
      }
    }

    // 最终结果
    output += '\n===== 最终结果 =====\n';
    output += result.success ? 'YES - 语义分析通过\n' : 'NO - 语义分析失败\n';

    return output;
  }
}

/**
 * 命令行入口
 */
export function runSemanticAnalyzer(args) {
  if (args.length < 4) {
    console.log('用法: node semantic.js <词法文法文件> <语法文法文件> <语义文法文件> <源代码文件>');
    console.log('示例: node semantic.js input/lex-grammar.txt input/syntax-grammar.txt input/semantic-grammar.txt input/source.txt');
    return;
  }

  const [lexGrammarFile, syntaxGrammarFile, semanticGrammarFile, sourceFile] = args;

  try {
    console.log('正在初始化语义分析器...');
    const analyzer = new SemanticAnalyzer(lexGrammarFile, syntaxGrammarFile, semanticGrammarFile);

    console.log(`正在分析源文件: ${sourceFile}`);
    const sourceCode = readFileSync(sourceFile, 'utf-8');
    const result = analyzer.analyze(sourceCode);

    const formattedResult = analyzer.formatResult(result);
    console.log(formattedResult);

    return result;

  } catch (error) {
    console.error('错误:', error.message);
    console.error(error.stack);
  }
}

// 如果直接运行此文件
if (process.argv[1] && process.argv[1].endsWith('semantic.js')) {
  runSemanticAnalyzer(process.argv.slice(2));
}
