// Let's start by implementing a Trie, because that's how we're going to store
// the automaton of our Aho-Corasick implementation

// Javascript Unicode
// https://dmitripavlutin.com/what-every-javascript-developer-should-know-about-unicode/
// https://medium.com/@giltayar/iterating-over-emoji-characters-the-es6-way-f06e4589516

// We'll create a new node for each character. That's not as efficient as
// collapsing several leaf nodes into a single node, but I don't yet know how
// to do that
// TODO: Collapse leaves
function makeNode(string, parent) {
  // We will store the parent node reference so we can easily construct the
  // failure links as outlined on Wikipedia:
  // https://en.wikipedia.org/wiki/Aho%E2%80%93Corasick_algorithm
  // > The target for the blue arc of a visited node can be found by following
  // > its parent's blue arc
  // It requires more space if we always assign these keys, but we won't worry
  // about that for now.
  return {
    value: string,
    children: {},
    isEnd: false,
    parent,
    dictionaryLink: null,
    failureLink: null,
  };
}

// "string" is any sequence of characters.
function insert(trie, string) {
  // We iterate over the input string character by character, and for each
  // character we check if it exists at the current *trie level*. If it does,
  // we go down a level. If it doesn't, we first create that node, then go down
  // a level.
  // Given this Trie:
  //      root   <-- empty root node
  //       |
  //       a
  //      / \
  //     b   d
  // and the input "abc", this is what the function below will do:
  // 1. Set "node" to root
  // 2. Start with "a"
  // 3. Check if node.children["a"] exists, with node = root
  // 4. It does! Descend one level by reassigning node to be the child of root with value "a"
  // 5. Do we have ["a"].children["b"]? Yes! Same as (4) above
  // 6. Do we have ["b"].children["c"]? No! Create it and we're done!

  let node = trie; // start at the root node
  let path = [];

  // "for..of" should handle unicode, including emojis. See links at the top.
  for (const char of string) {
    path.push(char);
    if (!node.children[char]) {
      node.children[char] = makeNode(path.join(""), node);
    }

    node = node.children[char];
  }

  node.isEnd = true;
}

function find(trie, needle) {
  let node = trie;

  for (const char of needle) {
    if (!node.children[char]) {
      return false;
    }
    node = node.children[char];
  }

  return node;
}

const root = makeNode("");
// const dictionary = ["a"];
const dictionary = ["a", "ab", "bab", "bc", "bca", "c", "caa"];
dictionary.forEach((w) => {
  insert(root, w);
});

// console.log(find(root, "ab"));
// console.log(find(root, "abc"));
// console.log(find(root, "abcd"));
// console.log(find(root, ""));

// The target for the failure link of a visited node can be found by following
// its parent's failure link to its longest suffix node and searching for a
// child of the suffix node whose character matches that of the visited node.
// If the character does not exist as a child, we can find the next longest
// suffix (following the failure link again) and then search for the character.
// We can do this until we either find the character (as child of a node) or we
// reach the root (which will always be a suffix of every string).
function findFailureLink(node, needle) {
  // root is the ultimate suffix
  return node.value == ""
    ? node
    : // Go to the parent, follow its failure link, and see if *that* node has a
      // child with the same value as the current node's value. Really, the
      // Wikipedia image explains it better than any text, so please go there.
      node.failureLink.children[needle] || findFailureLink(node.parent, needle);
}

function makeAutomaton(trie) {
  const q = [["", trie]];
  const seen = new Set([trie.value]);

  while (q.length > 0) {
    const [key, n] = q.shift();
    seen.add(n.value);

    // root doesn't have a parent
    if (n.parent) {
      // There's a reason I'm using n.parent here. With recursive functions
      // there's usually an elegant combination of where you start and what you
      // define as your exit condition. If you don't figure this out you'll end
      // up with lots of seemingly redundant if statements. Basically you
      // shouldn't have to follow parent or child references too much in your
      // recursive function, ideally it only operates on the current value. I
      // haven't spent too much time optimizing this in terms of clarity but
      // starting from the parent made "findFailureLink" easier to write than
      // when starting from the current node.
      n.failureLink = findFailureLink(n.parent, key);
      n.dictionaryLink = findDictionaryLink(n);
    }

    for (const [key, child] of Object.entries(n.children)) {
      if (!seen.has(child.value)) {
        q.push([key, child]);
      }
    }
  }
}

makeAutomaton(root);

// We have lots of circular references in the Trie so let's write a really bad
// custom printer
function printTrie(trie, depth = 0) {
  console.log(" ".repeat(depth), "value:", trie.value);
  console.log(" ".repeat(depth), "end:", trie.isEnd);
  if (trie.failureLink) {
    console.log(" ".repeat(depth), "failure link:", trie.failureLink.value);
  }
  if (trie.dictionaryLink) {
    console.log(
      " ".repeat(depth),
      "dictionary link:",
      trie.dictionaryLink.value
    );
  }

  for (const [_, child] of Object.entries(trie.children)) {
    printTrie(child, depth + 1);
  }
}

// There is a green "dictionary suffix" arc from each node to the next node in
// the dictionary that can be reached by following blue arcs. For example,
// there is a green arc from (bca) to (a) because (a) is the first node in the
// dictionary (i.e. a blue node) that is reached when following the blue arcs
// to (ca) and then on to (a). The green arcs can be computed in linear time by
// repeatedly traversing blue arcs until a blue node is found, and memoizing
// this information.
// ^--- from Wikipedia... I can follow the steps but I don't really know why
// this works.
function findDictionaryLink(node) {
  // No dictionary link for too
  if (node.value === "") {
    return null;
  }

  // Return memoized value if possible
  if (node.dictionaryLink) {
    return node.dictionaryLink;
  }

  // The actual dictionary link logic
  if (node.failureLink.isEnd) {
    return node.failureLink;
  }

  // If the first failureLink didn't work
  return findDictionaryLink(node.failureLink);
}

function findChild(node, char) {
  const child = node.children[char];
  // and if that doesn't exist, finding its suffix's child, and if that doesn't
  // work, finding its suffix's suffix's child, and so on, finally ending in
  // the root node if nothing's seen before.
  if (!child) {
    if (node.value === "") {
      return node;
    }
    return findChild(node.failureLink, char);
  }

  return child;
}

function followDictionaries(node) {
  const out = [];
  let n = node.dictionaryLink;
  while (n) {
    out.push(n.value);
    n = n.dictionaryLink;
  }
  return out;
}

// printTrie(root);
function ahocorasick(trie, needle) {
  const results = [];

  let node = trie;

  // At each step,
  for (const char of needle) {
    // the current node is extended by finding its child,
    const child = findChild(node, char);
    node = child;
    // In addition, the node itself is printed, if it is a dictionary entry.
    if (node.isEnd) {
      results.push(node.value);
    }
    // When the algorithm reaches a node, it outputs all the dictionary entries
    // that end at the current character position in the input text. This is
    // done by printing every node reached by following the dictionary suffix
    // links, starting from that node, and continuing until it reaches a node
    // with no dictionary suffix link.
    results.push(...followDictionaries(node));
  }

  return results;
}

console.log(ahocorasick(root, "abccab"));
