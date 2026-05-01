/**
 * DFA (确定性有限自动机) 实现
 * 使用子集构造法将NFA转换为DFA
 */

import { NFA, NFAState } from './nfa.js';

export class DFAState {
  constructor(id, nfaStates, isAccept = false, tokenType = null) {
    this.id = id;
    this.nfaStates = nfaStates; // 对应的NFA状态集合
    this.isAccept = isAccept;
    this.tokenType = tokenType; // 接受时的token类型
    this.transitions = new Map(); // char -> DFAState
  }
}

export class DFA {
  constructor(startState, states, alphabet) {
    this.startState = startState;
    this.states = states;
    this.alphabet = alphabet;
  }

  /**
   * 使用DFA识别字符串
   * @param {string} input - 输入字符串
   * @returns {Object} - {accepted: boolean, lastIndex: number, tokenType: string|null}
   */
  recognize(input) {
    let currentState = this.startState;
    let lastIndex = 0;

    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      const nextState = currentState.transitions.get(char);

      if (!nextState) {
        // 没有转移，检查当前状态是否为接受状态
        if (currentState.isAccept) {
          return {
            accepted: true,
            lastIndex: i,
            tokenType: currentState.tokenType
          };
        }
        return {
          accepted: false,
          lastIndex: i,
          tokenType: null
        };
      }

      currentState = nextState;
      lastIndex = i + 1;
    }

    // 输入结束，检查当前状态
    if (currentState.isAccept) {
      return {
        accepted: true,
        lastIndex: lastIndex,
        tokenType: currentState.tokenType
      };
    }

    return {
      accepted: false,
      lastIndex: lastIndex,
      tokenType: null
    };
  }
}

/**
 * 子集构造法：将NFA转换为DFA
 * @param {NFA} nfa - 输入的NFA
 * @param {string} tokenType - 该NFA对应的token类型
 * @returns {DFA} - 转换后的DFA
 */
export function subsetConstruction(nfa, tokenType) {
  const stateMap = new Map(); // 状态集合字符串 -> DFAState
  const states = [];
  let stateId = 0;

  // 获取字母表
  const alphabet = new Set();
  for (const state of nfa.states) {
    for (const char of state.transitions.keys()) {
      alphabet.add(char);
    }
  }

  // 计算初始状态的ε闭包
  const startNFAStates = nfa.epsilonClosure(new Set([nfa.startState]));
  const startKey = stateSetKey(startNFAStates);

  const startState = new DFAState(
    stateId++,
    startNFAStates,
    hasAcceptState(startNFAStates, nfa.acceptStates),
    hasAcceptState(startNFAStates, nfa.acceptStates) ? tokenType : null
  );

  stateMap.set(startKey, startState);
  states.push(startState);

  // 使用BFS构建DFA
  const queue = [startState];

  while (queue.length > 0) {
    const currentDFAState = queue.shift();

    for (const char of alphabet) {
      // 计算move(T, a)的ε闭包
      const moveResult = nfa.move(currentDFAState.nfaStates, char);
      if (moveResult.size === 0) continue;

      const nextNFAStates = nfa.epsilonClosure(moveResult);
      const nextKey = stateSetKey(nextNFAStates);

      let nextState = stateMap.get(nextKey);

      if (!nextState) {
        // 创建新的DFA状态
        nextState = new DFAState(
          stateId++,
          nextNFAStates,
          hasAcceptState(nextNFAStates, nfa.acceptStates),
          hasAcceptState(nextNFAStates, nfa.acceptStates) ? tokenType : null
        );
        stateMap.set(nextKey, nextState);
        states.push(nextState);
        queue.push(nextState);
      }

      // 添加转移
      currentDFAState.transitions.set(char, nextState);
    }
  }

  return new DFA(startState, states, alphabet);
}

/**
 * 将多个NFA合并为一个DFA
 * @param {Map<string, NFA>} nfas - 名称到NFA的映射
 * @returns {DFA} - 合并后的DFA
 */
export function combineNFAsToDFA(nfas) {
  // 创建一个新的NFA，通过ε转移连接所有NFA
  const combinedNFA = createCombinedNFA(nfas);
  // 转换为DFA
  return subsetConstruction(combinedNFA, 'COMBINED');
}

/**
 * 创建合并的NFA
 */
function createCombinedNFA(nfas) {

  const states = [];
  let stateId = 0;

  // 创建新的开始状态
  const newStart = new NFAState(stateId++);
  states.push(newStart);

  // 合并所有NFA
  for (const [name, nfa] of nfas) {
    // 重新映射状态ID
    const stateMapping = new Map();

    for (const state of nfa.states) {
      const newState = new NFAState(stateId++);
      stateMapping.set(state.id, newState);
      states.push(newState);
    }

    // 复制转移
    for (const state of nfa.states) {
      const newState = stateMapping.get(state.id);

      for (const [char, nextStates] of state.transitions) {
        for (const nextState of nextStates) {
          newState.addTransition(char, stateMapping.get(nextState.id));
        }
      }

      for (const epsilonState of state.epsilonTransitions) {
        newState.addEpsilonTransition(stateMapping.get(epsilonState.id));
      }

      // 设置接受状态
      if (state.isAccept) {
        newState.isAccept = true;
        newState.tokenType = name;
      }
    }

    // 新开始状态ε转移到每个NFA的开始状态
    newStart.addEpsilonTransition(stateMapping.get(nfa.startState.id));
  }

  // 收集所有接受状态
  const acceptStates = new Set(states.filter(s => s.isAccept));

  return new NFA(newStart, acceptStates, states);
}

/**
 * 生成状态集合的唯一键
 */
function stateSetKey(states) {
  const ids = [...states].map(s => s.id).sort((a, b) => a - b);
  return ids.join(',');
}

/**
 * 检查状态集合中是否包含接受状态
 */
function hasAcceptState(states, acceptStates) {
  for (const state of states) {
    if (state.isAccept || acceptStates.has(state)) {
      return true;
    }
  }
  return false;
}
