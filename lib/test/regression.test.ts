import { describe, it, expect } from 'vitest';
import { parseRegex, nfaFromSyntaxTree, dfaFromNfa, minimizeDfa, matchDfa } from '../src/index';

/**
 * Regression tests for specific bugs that were fixed.
 * These tests ensure that previously fixed bugs don't reappear.
 */

describe('Regression: Fallback Transitions Bug', () => {
  /**
   * BUG: matchDfa was returning false for strings that should match
   * 
   * ROOT CAUSE: DFA construction was missing fallback transitions for states
   * that were trying to match specific patterns. When the DFA was in a state
   * attempting to match 'abc' and encountered a character that didn't match
   * the expected next character, it had no way to fall back and retry.
   * 
   * FIX: Added post-processing step to DFA construction that:
   * 1. Identifies states without ANYCHAR transitions
   * 2. Adds ANYCHAR fallback transitions to the appropriate fallback state
   * 3. Adds specific character transitions from the fallback state to allow
   *    pattern matching to restart
   * 
   * EXAMPLE: For pattern (.*)(abc)(.*) and string "jdioaabczd":
   * - Without fix: State machine gets stuck when seeing 'a' followed by 'a'
   * - With fix: Falls back to wildcard state and retries matching 'abc'
   */
  
  it('should match string with pattern in the middle - original bug case', () => {
    const regex = parseRegex('(.*)(abc)(.*)');
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);
    
    // This was the original failing case
    expect(matchDfa(dfa, 'jdioaabczd')).toBe(true);
  });

  it('should work with minimized DFA', () => {
    const regex = parseRegex('(.*)(abc)(.*)');
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);
    const minDfa = minimizeDfa(dfa);
    
    expect(matchDfa(minDfa, 'jdioaabczd')).toBe(true);
  });

  it('should handle repeated starting characters', () => {
    const regex = parseRegex('(.*)(abc)');
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);
    
    // Multiple 'a's before 'abc'
    expect(matchDfa(dfa, 'aabc')).toBe(true);
    expect(matchDfa(dfa, 'aaabc')).toBe(true);
    expect(matchDfa(dfa, 'aaaabc')).toBe(true);
  });

  it('should handle pattern at different positions', () => {
    const regex = parseRegex('(.*)(abc)(.*)');
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);
    
    // Pattern at start
    expect(matchDfa(dfa, 'abc')).toBe(true);
    expect(matchDfa(dfa, 'abcxyz')).toBe(true);
    
    // Pattern in middle
    expect(matchDfa(dfa, 'xyzabcxyz')).toBe(true);
    
    // Pattern at end
    expect(matchDfa(dfa, 'xyzabc')).toBe(true);
  });

  it('should handle partial matches that fail', () => {
    const regex = parseRegex('(.*)(abc)');
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);
    
    // Strings with 'ab' but not 'abc'
    expect(matchDfa(dfa, 'ab')).toBe(false);
    expect(matchDfa(dfa, 'xyzab')).toBe(false);
    expect(matchDfa(dfa, 'ababab')).toBe(false);
    
    // But these should match
    expect(matchDfa(dfa, 'abc')).toBe(true);
    expect(matchDfa(dfa, 'ababc')).toBe(true);
  });

  it('should handle different patterns with wildcards', () => {
    // Test with different patterns to ensure fix is general
    const patterns = [
      '(.*)(test)',
      '(.*)(xyz)',
      '(.*)(hello)',
    ];

    patterns.forEach(pattern => {
      const regex = parseRegex(pattern);
      const nfa = nfaFromSyntaxTree(regex);
      const dfa = dfaFromNfa(nfa);

      // Extract the literal part (remove (.*) and parentheses)
      const literal = pattern.replace('(.*)', '').replace(/[()]/g, '');

      // Should match when literal is at the end (greedy .* consumes everything before)
      expect(matchDfa(dfa, literal)).toBe(true);
      expect(matchDfa(dfa, 'x' + literal)).toBe(true);
      // Note: literal + 'x' would fail due to greedy matching - .* consumes everything
    });
  });

  it('should handle complex patterns with multiple wildcards', () => {
    const regex = parseRegex('(.*)(a)(.*)(b)(.*)');
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);
    
    // Should match strings containing both 'a' and 'b' (in that order)
    expect(matchDfa(dfa, 'ab')).toBe(true);
    expect(matchDfa(dfa, 'aXb')).toBe(true);
    expect(matchDfa(dfa, 'XaXbX')).toBe(true);
    expect(matchDfa(dfa, 'aaabbb')).toBe(true);
    
    // Should not match if 'b' comes before 'a'
    expect(matchDfa(dfa, 'ba')).toBe(false);
    expect(matchDfa(dfa, 'b')).toBe(false);
    expect(matchDfa(dfa, 'a')).toBe(false);
  });

  it('should handle edge case with single character after wildcard', () => {
    const regex = parseRegex('(.*)(x)');
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);
    
    expect(matchDfa(dfa, 'x')).toBe(true);
    expect(matchDfa(dfa, 'xx')).toBe(true);
    expect(matchDfa(dfa, 'xxx')).toBe(true);
    expect(matchDfa(dfa, 'abcx')).toBe(true);
    expect(matchDfa(dfa, 'xabcx')).toBe(true);
  });

  it('should verify DFA has fallback transitions', () => {
    const regex = parseRegex('(.*)(abc)');
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);
    
    // Check that states have ANYCHAR transitions (fallback)
    // This is a structural test to ensure the fix is in place
    let hasAnyCharTransitions = false;
    
    for (const stateId of dfa.states) {
      const transitions = dfa.transitions[stateId];
      if (transitions && transitions['ANYCHAR'] !== undefined) {
        hasAnyCharTransitions = true;
        break;
      }
    }
    
    expect(hasAnyCharTransitions).toBe(true);
  });

  it('should handle the exact execution trace from the bug', () => {
    /**
     * Original bug execution trace for "jdioaabczd" with pattern (.*)(abc)(.*):
     * 
     * State 1, char 'j' -> 1  (ANYCHAR)
     * State 1, char 'd' -> 1  (ANYCHAR)
     * State 1, char 'i' -> 1  (ANYCHAR)
     * State 1, char 'o' -> 1  (ANYCHAR)
     * State 1, char 'a' -> 2  (specific 'a' transition)
     * State 2, char 'a' -> undefined  ❌ BUG: No transition!
     * 
     * After fix:
     * State 1, char 'a' -> 2  (specific 'a' transition)
     * State 2, char 'a' -> 2  (fallback 'a' transition added)
     * State 2, char 'b' -> 3
     * State 3, char 'c' -> 0  (accepting state)
     * ... continues matching
     */
    
    const regex = parseRegex('(.*)(abc)(.*)');
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);
    
    // The exact string from the bug report
    const testString = 'jdioaabczd';
    
    expect(matchDfa(dfa, testString)).toBe(true);
    
    // Also test the minimized version
    const minDfa = minimizeDfa(dfa);
    expect(matchDfa(minDfa, testString)).toBe(true);
  });
});

describe('Regression: Other Potential Issues', () => {
  it('should not break simple patterns without wildcards', () => {
    // Ensure the fix doesn't break simple cases
    const regex = parseRegex('abc');
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);
    
    expect(matchDfa(dfa, 'abc')).toBe(true);
    expect(matchDfa(dfa, 'ab')).toBe(false);
    expect(matchDfa(dfa, 'abcd')).toBe(false);
  });

  it('should not break patterns with only wildcards', () => {
    const regex = parseRegex('.*');
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);
    
    expect(matchDfa(dfa, '')).toBe(true);
    expect(matchDfa(dfa, 'anything')).toBe(true);
  });

  it('should not break alternation patterns', () => {
    const regex = parseRegex('a|b');
    const nfa = nfaFromSyntaxTree(regex);
    const dfa = dfaFromNfa(nfa);
    
    expect(matchDfa(dfa, 'a')).toBe(true);
    expect(matchDfa(dfa, 'b')).toBe(true);
    expect(matchDfa(dfa, 'c')).toBe(false);
  });
});

