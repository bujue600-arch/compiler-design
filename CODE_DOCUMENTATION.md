# 代码说明文档

## 1. 词法分析器模块

### 1.1 NFA实现 (`src/lexer/nfa.js`)

#### 核心类

**NFAState类**
```javascript
class NFAState {
  constructor(id, isAccept = false)
  addTransition(char, state)    // 添加字符转移
  addEpsilonTransition(state)   // 添加ε转移
}
```

**NFA类**
```javascript
class NFA {
  constructor(startState, acceptStates, states)
  epsilonClosure(states)  // 计算ε闭包
  move(states, char)      // 计算move操作
}
```

#### 关键函数

**buildNFAFromGrammar(grammar)**
- 功能：从正规文法构建NFA
- 输入：文法规则数组 `[{left, right}]`
- 输出：NFA对象
- 算法：
  1. 为每个非终结符创建状态
  2. 根据产生式添加转移
  3. 处理ε产生式

### 1.2 DFA实现 (`src/lexer/dfa.js`)

#### 核心类

**DFAState类**
```javascript
class DFAState {
  constructor(id, nfaStates, isAccept = false, tokenType = null)
}
```

**DFA类**
```javascript
class DFA {
  constructor(startState, states, alphabet)
  recognize(input)  // 使用DFA识别字符串
}
```

#### 关键函数

**subsetConstruction(nfa, tokenType)**
- 功能：子集构造法，将NFA转换为DFA
- 输入：NFA对象，token类型
- 输出：DFA对象
- 算法：
  1. 计算初始状态的ε闭包
  2. 对每个输入符号计算move(T, a)
  3. 对结果计算ε闭包
  4. 重复直到没有新状态

### 1.3 词法分析器主模块 (`src/lexer/lexer.js`)

#### Lexer类

```javascript
class Lexer {
  constructor(grammarFile)        // 初始化，读取文法文件
  parseGrammarFile(filePath)      // 解析文法文件
  buildDFAs()                     // 为每个规则构建DFA
  analyze(sourceCode)             // 对源代码进行词法分析
  recognizeToken(line, pos, lineNum)  // 识别单个token
  recognizeNumber(line, pos, lineNum) // 识别数字常量
  recognizeIdentifier(line, pos, lineNum) // 识别标识符
  recognizeOperator(line, pos, lineNum)   // 识别运算符
  recognizeDelimiter(line, pos, lineNum)  // 识别界符
  recognizeString(line, pos, lineNum)     // 识别字符串常量
}
```

#### Token类型定义

```javascript
const TokenType = {
  KEYWORD: 'KEYWORD',        // 关键字
  IDENTIFIER: 'IDENTIFIER',  // 标识符
  CONSTANT: 'CONSTANT',      // 常量
  DELIMITER: 'DELIMITER',    // 界符
  OPERATOR: 'OPERATOR'       // 运算符
};
```

#### 特殊常量识别

**科学计数法识别**
- 格式：`0.314E+1`, `1.5e-3`
- 识别逻辑：
  1. 识别整数/小数部分
  2. 检查E/e
  3. 检查指数符号(+/-)
  4. 识别指数

**复数常量识别**
- 格式：`10+12i`, `3i`, `2.5-1.5i`
- 识别逻辑：
  1. 识别实部
  2. 检查虚部标记(i)
  3. 识别完整复数

---

## 2. LR(1)语法分析器模块

### 2.1 核心数据结构 (`src/parser/lr1.js`)

#### Production类
```javascript
class Production {
  constructor(left, right, index)
  toString()  // 格式化输出
}
```

#### LR1Item类 (LR(1)项目)
```javascript
class LR1Item {
  constructor(production, dotPos, lookahead)
  nextSymbol()     // 获取点后面的符号
  isComplete()     // 点是否在最后
  advance()        // 移动点
  equals(other)    // 判断相等
}
```

#### ItemSet类 (项目集)
```javascript
class ItemSet {
  constructor(items = [], id = 0)
  equals(other)  // 判断项目集相等
}
```

### 2.2 LR1Parser类

```javascript
class LR1Parser {
  constructor(grammarFile)           // 初始化，构建分析表
  parseGrammarFile(filePath)         // 解析文法文件
  augmentGrammar()                   // 扩展文法
  initSymbols()                      // 初始化符号集
  computeFirstSets()                 // 计算FIRST集
  firstOfString(symbols)             // 计算符号串的FIRST集
  closure(items)                     // 计算项目集闭包
  goto(items, symbol)                // 计算GOTO函数
  getItemSetKey(items)               // 生成项目集唯一键
  buildItemSets()                    // 构建项目集规范族
  buildTables()                      // 构建ACTION/GOTO表
  parse(tokens)                      // 语法分析
  getTokenSymbol(token)              // token转文法符号
  formatStack(stack)                 // 格式化分析栈
  analyzeError(stack, input, pos, tokens) // 分析错误
  printTables()                      // 打印分析表
  printItemSets()                    // 打印项目集规范族
}
```

### 2.3 算法详解

#### FIRST集计算算法

```
1. 对于每个终结符a，FIRST(a) = {a}
2. 对于产生式 A -> X1X2...Xk:
   - 将FIRST(X1)中非ε元素加入FIRST(A)
   - 如果X1可推导出ε，继续检查X2
   - 如果所有Xi都可推导出ε，将ε加入FIRST(A)
3. 重复直到没有变化
```

#### 项目集闭包计算

```
closure(I):
  repeat
    for I中每个项目 [A -> α·Bβ, a]
      for 文法中每个产生式 B -> γ
        for FIRST(βa)中每个符号 b
          添加 [B -> ·γ, b] 到闭包
  until 没有新项目添加
```

#### ACTION/GOTO表构建

```
对于项目集Ii:
  1. 移进项目 [A -> α·aβ, b]:
     ACTION[i, a] = sj  (j是GOTO(Ii, a)的状态号)

  2. 归约项目 [A -> α·, a]:
     如果A不是S':
       ACTION[i, a] = rj  (j是产生式编号)
     否则:
       ACTION[i, $] = accept

  3. GOTO表:
     GOTO[i, A] = j  (j是GOTO(Ii, A)的状态号)
```

### 2.4 语法分析过程

```
初始化: 状态栈=[0], 符号栈=[$], 输入=w$
repeat
  设s为栈顶状态, a为当前输入符号
  if ACTION[s, a] = sj:
    push(a), push(j)
    读取下一个输入符号
  else if ACTION[s, a] = rj (A -> β):
    pop(|β|个符号和状态)
    设t为新栈顶状态
    push(A), push(GOTO[t, A])
    输出产生式 A -> β
  else if ACTION[s, a] = accept:
    分析成功
  else:
    错误处理
```

---

## 3. 语义分析器模块 (`src/semantic/semantic.js`)

### 3.1 符号表管理

#### SymbolTableEntry类
```javascript
class SymbolTableEntry {
  constructor(name, type, value = null, line = 0)
  setAttribute(key, value)  // 设置属性
  getAttribute(key)         // 获取属性
}
```

#### SymbolTable类
```javascript
class SymbolTable {
  constructor(parent = null)
  lookup(name)              // 查找符号（支持作用域链）
  define(entry)             // 定义符号
  update(name, value)       // 更新符号值
  createChildScope()        // 创建子作用域
  getAllSymbols()            // 获取所有符号
}
```

### 3.2 语义动作处理

#### SemanticAction类
```javascript
class SemanticAction {
  constructor(name, params, body)
  execute(context)  // 执行语义动作
}
```

### 3.3 语义分析功能

#### 变量声明处理
```
processDeclaration(tokens, startIndex):
  1. 读取类型关键字
  2. 读取变量名列表
  3. 检查重复定义
  4. 添加到符号表
  5. 处理初始化表达式
```

#### 赋值语句处理
```
processAssignment(tokens, startIndex):
  1. 检查变量是否已定义
  2. 计算右侧表达式
  3. 类型兼容性检查
  4. 更新变量值
```

#### 表达式求值
```
evaluateExpression(tokens, startIndex):
  1. 使用递归下降法
  2. 处理运算符优先级
  3. 支持括号
  4. 返回计算结果
```

### 3.4 错误检测

- **变量未定义错误**：使用未声明的变量
- **重复定义错误**：同一作用域内重复声明
- **类型不兼容警告**：赋值类型不匹配
- **除零错误**：运行时错误检测
- **未初始化警告**：使用未赋值的变量

---

## 4. 文件格式说明

### 4.1 词法文法文件格式

```
// 注释
# 规则名称
产生式1
产生式2
...

// 示例：
# IDENTIFIER
I -> aI1 | bI1 | _I1
I1 -> aI1 | 0I1 | ε
```

**规则说明**：
- `#` 开头表示规则名称（对应token类型）
- `->` 分隔左部和右部
- `|` 分隔多个选择
- `ε` 表示空串
- 单个字符表示终结符

### 4.2 语法文法文件格式

```
// 注释
左部 -> 右部1 | 右部2 | ...

// 示例：
S -> E
E -> E + T | T
T -> T * F | F
F -> ( E ) | id | num
```

**约定**：
- `id` 表示标识符
- `num` 表示数字常量
- 小写字母串表示终结符
- 大写字母串表示非终结符

### 4.3 语义文法文件格式

```
// 注释
产生式 { 语义动作 }

// 示例：
E -> E + T { E.val = E1.val + T.val }
E -> T { E.val = T.val }
F -> num { F.val = num.lexval }
```

**语义动作说明**：
- 使用 `符号.属性` 访问属性
- 同名符号使用数字后缀区分（E, E1）
- 支持算术运算：+, -, *, /

### 4.4 Token输出格式

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
  },
  {
    "line": 1,
    "type": "OPERATOR",
    "value": "="
  },
  {
    "line": 1,
    "type": "CONSTANT",
    "value": "10"
  },
  {
    "line": 1,
    "type": "DELIMITER",
    "value": ";"
  }
]
```

---

## 5. 关键算法实现细节

### 5.1 ε-闭包计算

```javascript
epsilonClosure(states) {
  const closure = new Set(states);
  const stack = [...states];

  while (stack.length > 0) {
    const state = stack.pop();
    for (const epsilonState of state.epsilonTransitions) {
      if (!closure.has(epsilonState)) {
        closure.add(epsilonState);
        stack.push(epsilonState);
      }
    }
  }

  return closure;
}
```

**时间复杂度**：O(n)，其中n是状态数

### 5.2 子集构造法

```javascript
subsetConstruction(nfa, tokenType) {
  // 1. 初始化
  const startClosure = nfa.epsilonClosure([nfa.start]);
  const dfaStates = new Map();
  const queue = [startClosure];

  // 2. BFS遍历
  while (queue.length > 0) {
    const current = queue.shift();

    // 3. 对每个输入符号
    for (const symbol of alphabet) {
      const next = nfa.epsilonClosure(nfa.move(current, symbol));

      if (next.size > 0) {
        // 4. 添加DFA转移
        if (!dfaStates.has(next)) {
          dfaStates.set(next, new DFAState(next));
          queue.push(next);
        }
      }
    }
  }
}
```

**时间复杂度**：O(2^n)，最坏情况指数级

### 5.3 LR(1)项目集规范族构建

```javascript
buildItemSets() {
  // 1. 初始项目集
  const initial = closure([S' -> ·S, $]);
  const C = [initial];
  const queue = [initial];

  // 2. BFS构建
  while (queue.length > 0) {
    const I = queue.shift();

    // 3. 对每个文法符号
    for (const X of grammar.symbols) {
      const next = goto(I, X);

      if (next.length > 0 && !C.includes(next)) {
        C.push(next);
        queue.push(next);
      }
    }
  }
}
```

**时间复杂度**：O(n * m)，其中n是状态数，m是文法符号数

---

## 6. 性能优化建议

### 6.1 词法分析器优化

1. **DFA最小化**：合并等价状态
2. **关键字哈希表**：O(1)查找
3. **缓冲区优化**：减少内存分配

### 6.2 语法分析器优化

1. **表压缩**：稀疏矩阵存储
2. **状态合并**：LALR(1)合并同心状态
3. **错误恢复**：恐慌模式恢复

### 6.3 语义分析器优化

1. **符号表分层**：哈希表实现
2. **类型缓存**：避免重复计算
3. **惰性求值**：按需计算属性

---

## 7. 扩展接口

### 7.1 添加新的token类型

```javascript
// 在lexer.js中添加
const TokenType = {
  // ... 现有类型
  NEW_TYPE: 'NEW_TYPE'
};

// 在recognizeToken中添加识别逻辑
recognizeNewType(line, pos, lineNum) {
  // 实现识别逻辑
}
```

### 7.2 添加新的语义动作

```javascript
// 在semantic-grammar.txt中定义
E -> E + T { E.val = E1.val + T.val; E.type = 'int' }

// 在semantic.js中扩展evaluateExpression
if (operator === '+') {
  // 添加类型推断逻辑
}
```

### 7.3 自定义错误处理

```javascript
// 在lr1.js中扩展analyzeError
analyzeError(stack, input, pos, tokens) {
  // 添加更详细的错误信息
  // 实现错误恢复策略
}
```

---

## 8. 调试技巧

### 8.1 打印中间结果

```javascript
// 打印NFA状态
console.log('NFA States:', nfa.states);

// 打印DFA转移表
for (const [state, transitions] of dfa.transitions) {
  console.log(`State ${state}:`, transitions);
}

// 打印项目集
parser.printItemSets();

// 打印分析表
parser.printTables();
```

### 8.2 断点调试建议

1. **词法分析**：在`recognizeToken`中设置断点
2. **语法分析**：在`parse`方法的主循环中设置断点
3. **语义分析**：在`performSemanticAnalysis`中设置断点

### 8.3 日志输出

```javascript
// 启用详细日志
const DEBUG = true;

if (DEBUG) {
  console.log('Step:', step);
  console.log('Stack:', stack);
  console.log('Input:', input);
}
```

---

## 9. 常见问题解答

### Q1: 如何处理文法冲突？

A: 冲突类型及解决方法：
- **移进-归约冲突**：通常可以通过调整文法或使用优先级规则解决
- **归约-归约冲突**：需要重新设计文法，消除歧义

### Q2: 如何支持更多数据类型？

A: 在符号表中扩展类型系统：
```javascript
const TypeSystem = {
  INT: { size: 4, name: 'int' },
  FLOAT: { size: 8, name: 'float' },
  // 添加更多类型...
};
```

### Q3: 如何优化错误恢复？

A: 实现恐慌模式恢复：
```javascript
// 跳过输入直到找到同步符号
while (!isSyncSymbol(currentToken)) {
  advance();
}
```

---

## 10. 参考资料

1. 《编译原理》（龙书）- Aho, Lam, Sethi, Ullman
2. 《现代编译原理》（虎书）- Appel
3. 《编译器设计》- Muchnick
4. [ANTLR文档](https://www.antlr.org/)
5. [LLVM教程](https://llvm.org/docs/tutorial/)
