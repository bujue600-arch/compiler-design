/**
 * NFA (不确定性有限自动机) 实现
 * 用于从正规文法构建非确定性有限自动机
 */

export class NFAState {
  constructor(id, isAccept = false) {
    this.id = id;
    this.isAccept = isAccept;
    this.transitions = new Map(); // char -> Set<NFAState>
    this.epsilonTransitions = new Set(); // ε转移
  }

  addTransition(char, state) {
    if (!this.transitions.has(char)) {
      this.transitions.set(char, new Set());
    }
    this.transitions.get(char).add(state);
  }

  addEpsilonTransition(state) {
    this.epsilonTransitions.add(state);
  }
}

export class NFA {
  constructor(startState, acceptStates, states) {
    this.startState = startState;
    this.acceptStates = acceptStates;
    this.states = states;
  }

  /**
   * 计算ε闭包
   * @param {Set<NFAState>} states - 状态集合
   * @returns {Set<NFAState>} - ε闭包
   */
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

  /**
   * 计算从一组状态经过某个字符能到达的状态集合
   * @param {Set<NFAState>} states - 状态集合
   * @param {string} char - 输入字符
   * @returns {Set<NFAState>} - 可达状态集合
   */
  move(states, char) {
    const result = new Set();
    for (const state of states) {
      const nextStates = state.transitions.get(char);
      if (nextStates) {
        for (const nextState of nextStates) {
          result.add(nextState);
        }
      }
    }
    return result;
  }
}

/**
 * 从正规文法构建NFA
 * 正规文法格式: A -> aB | A -> a | A -> ε
 */
export function buildNFAFromGrammar(grammar) {
  const stateMap = new Map(); // 非终结符 -> NFAState
  const states = [];
  let stateId = 0;

  // 创建开始状态
  const startState = new NFAState(stateId++);
  states.push(startState);

  // 为每个非终结符创建状态
  for (const rule of grammar) {
    if (!stateMap.has(rule.left)) {
      const state = new NFAState(stateId++);
      stateMap.set(rule.left, state);
      states.push(state);
    }
  }

  // 创建接受状态
  const acceptState = new NFAState(stateId++, true);
  states.push(acceptState);

  // 处理产生式
  for (const rule of grammar) {
    const currentState = stateMap.get(rule.left);

    for (const production of rule.right) {
      if (production === 'ε' || production === '') {
        // A -> ε
        currentState.addEpsilonTransition(acceptState);
      } else if (production.length === 1) {
        // A -> a (终结符)
        currentState.addTransition(production, acceptState);
      } else if (production.length === 2) {
        // A -> aB (终结符 + 非终结符)
        const char = production[0];
        const nextStateName = production[1];

        if (!stateMap.has(nextStateName)) {
          const newState = new NFAState(stateId++);
          stateMap.set(nextStateName, newState);
          states.push(newState);
        }

        currentState.addTransition(char, stateMap.get(nextStateName));
      }
    }
  }

  // 开始状态通过ε转移到文法的开始符号
  const grammarStartSymbol = grammar[0]?.left;
  if (grammarStartSymbol && stateMap.has(grammarStartSymbol)) {
    startState.addEpsilonTransition(stateMap.get(grammarStartSymbol));
  }

  return new NFA(startState, new Set([acceptState]), states);
}

/**
 * 从多个正规文法构建NFA（合并多个正规式）
 * @param {Array} grammars - 文法规则数组，每个元素包含 name 和 rules
 * @returns {Map<string, NFA>} - 名称到NFA的映射
 */
export function buildNFAsFromGrammars(grammars) {
  const nfas = new Map();

  for (const grammar of grammars) {
    const nfa = buildNFAFromGrammar(grammar.rules);
    nfas.set(grammar.name, nfa);
  }

  return nfas;
}
