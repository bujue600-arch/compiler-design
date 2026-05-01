# 编译原理课程设计

## 项目概述

本项目实现了编译原理课程设计的三个核心任务：

1. **任务1：词法分析器** - 使用NFA/DFA实现token识别
2. **任务2：LR(1)语法分析器** - 实现LR(1)分析表构建和语法分析
3. **任务3：语义分析器** - 实现属性文法和语义规则

## 项目结构

```
compiler-design/
├── src/
│   ├── lexer/
│   │   ├── nfa.js          # NFA实现
│   │   ├── dfa.js          # DFA实现（子集构造法）
│   │   └── lexer.js        # 词法分析器主模块
│   ├── parser/
│   │   ├── lr1.js          # LR(1)分析器核心
│   │   └── parser.js       # 语法分析器主模块
│   ├── semantic/
│   │   └── semantic.js     # 语义分析器
│   └── index.js            # 主入口
├── input/
│   ├── lex-grammar.txt     # 词法文法示例
│   ├── syntax-grammar.txt  # 语法文法示例
│   ├── semantic-grammar.txt # 语义文法示例
│   ├── source.txt          # 源代码示例
│   ├── test-complex.txt    # 复杂测试用例
│   └── test-error.txt      # 错误测试用例
├── output/                 # 输出目录
├── package.json
└── README.md
```

## 环境要求

- Node.js >= 14.0.0
- npm >= 6.0.0

## 安装

```bash
# 进入项目目录
cd compiler-design

# 安装依赖（如果有）
npm install
```

## 使用方法

### 1. 词法分析

```bash
node src/index.js --lex
```

或指定自定义文件：

```bash
node src/index.js --lex --lex-grammar input/lex-grammar.txt --source input/source.txt
```

### 2. 语法分析（LR(1)）

```bash
node src/index.js --parse
```

打印LR(1)分析表：

```bash
node src/index.js --parse --tables
```

打印项目集规范族：

```bash
node src/index.js --parse --items
```

### 3. 语义分析

```bash
node src/index.js --semantic
```

### 4. 帮助信息

```bash
node src/index.js --help
```

## 文法文件格式

### 词法文法文件 (lex-grammar.txt)

```
# 规则名称
产生式

# 示例：
# IDENTIFIER
I -> aI1 | bI1 | cI1 | _I1
I1 -> aI1 | bI1 | 0I1 | ε
```

支持的token类型：

- `KEYWORD` - 关键字
- `IDENTIFIER` - 标识符
- `CONSTANT` - 常量（整数、浮点数、科学计数法、复数）
- `OPERATOR` - 运算符
- `DELIMITER` - 界符

### 语法文法文件 (syntax-grammar.txt)

```
左部 -> 右部1 | 右部2 | ...

# 示例：
S -> E
E -> E + T | T
T -> T * F | F
F -> ( E ) | id | num
```

注意事项：

- 使用 `id` 表示标识符
- 使用 `num` 表示数字常量
- 支持 `ε` 表示空产生式

### 语义文法文件 (semantic-grammar.txt)

```
产生式 { 语义动作 }

# 示例：
E -> E + T { E.val = E1.val + T.val }
E -> T { E.val = T.val }
F -> num { F.val = num.lexval }
```

## 功能特性

### 词法分析器

- 支持NFA到DFA的转换（子集构造法）
- 识别5种token类型
- 支持科学计数法（如 `0.314E+1`）
- 支持复数常量（如 `10+12i`）
- 支持单行和多行注释
- 错误检测和报告

### LR(1)语法分析器

- 完整的LR(1)项目集规范族构建
- 自动生成ACTION和GOTO表
- 详细的分析过程输出
- 错误位置和原因报告
- 支持移进-归约和归约-归约冲突检测

### 语义分析器

- 符号表管理
- 变量声明和类型检查
- 表达式求值
- 语义错误检测
- 中间代码生成

## 输出说明

### Token表格式

```json
[
  {
    "line": 1,
    "type": "KEYWORD",
    "value": "int"
  },
  {
    "line": 1,
    "type": "IDENTIFIER",
    "value": "x"
  }
]
```

### 分析过程输出

```
步骤    栈                              输入                    动作
0       $0                              id + id $               移进到状态5
1       $0id5                           + id $                  归约：F -> id
...
```

## 测试用例

### 基本测试

```bash
node src/index.js --lex --source input/source.txt
```

### 复杂测试

```bash
node src/index.js --semantic --source input/test-complex.txt
```

### 错误检测测试

```bash
node src/index.js --parse --source input/test-error.txt
```

## 常见问题

### 1. 如何添加新的关键字？

编辑 `src/lexer/lexer.js` 中的 `KEYWORDS` 集合：

```javascript
const KEYWORDS = new Set([
  'int', 'float', 'double', 'char', 'void', 'bool',
  'if', 'else', 'while', 'for', 'do',
  // 添加新关键字...
  'your_keyword'
]);
```

### 2. 如何修改文法规则？

编辑 `input/` 目录下对应的文法文件。确保格式正确：

- 每行一个产生式
- 使用 `|` 分隔多个选择
- 使用 `ε` 表示空串

### 3. 分析表出现冲突怎么办？

LR(1)分析可能遇到移进-归约冲突或归约-归约冲突。解决方法：

- 检查文法是否为LR(1)文法
- 考虑重写文法消除冲突
- 或使用其他分析方法（如SLR、LALR）

## 技术细节

### NFA到DFA转换

使用子集构造法：

1. 计算初始状态的ε闭包
2. 对每个输入符号计算move操作
3. 对结果状态集计算ε闭包
4. 重复直到没有新状态

### LR(1)分析表构建

1. 构建扩展文法（添加S' -> S）
2. 计算FIRST集
3. 构建LR(1)项目集规范族
4. 根据项目集生成ACTION和GOTO表

### 语义分析

1. 构建符号表
2. 遍历语法树
3. 执行语义动作
4. 收集语义错误和警告

## 扩展功能

如需扩展功能，可以：

1. 添加更多token类型
2. 实现更复杂的语义规则
3. 添加代码优化
4. 生成目标代码

## 许可证

本项目仅供学习使用。

## 作者

[bujue600-arch/compiler-design](https://github.com/bujue600-arch/compiler-design)

编译原理课程设计
