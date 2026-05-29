#!/usr/bin/env node
/**
 * Doraemon Face - ASCII art in your terminal
 * Run with: node scripts/doraemon-face.js
 */

import pc from "picocolors";

const { blue, yellow, red, cyan, bold, reset } = pc;

const face = [
  blue("      ┉┉╱▔▔▔▔▔▔▔▔╲┉┉"),
  blue("     ┉╱┉┉╱▔╲╱▔╲┉┉╲┉"),
  blue("    ╱┉╱▔▏") + "▇" + blue("▕▏") + "▇" + blue("▕▔╲┉╲"),
  blue("   ▏╱╲┉╲▂╭╮▂╱┉╱╲▕"),
  blue("   ▏▏━╭╮┉╰╯┉╭╮━▕▕"),
  blue("   ▏▏╱╰┳━┻┻━┳╯╲▕▕"),
  blue("   ▏▏┉┉┃╭━━╮┃┅┅▕▕"),
  blue("   ╲╲┉┉╰┻━━┻╯┉┉╱╱"),
  blue("    ┉╲") + yellow("╲▄▄▄▄▄▄▄▄▄▄▄") + blue("╱╱"),
  "         " + yellow("│  ") + red("●") + yellow("  │"),
  "         " + yellow("╰───────╯"),
];

// Alternative: even cuter small version
const cute = blue("       ∧＿∧\n") +
             blue("      ( ･ω･) ") + red("＜  ドラえもん！") + "\n" +
             blue("     /　　つ\n") +
             blue("    (　　ﾉ\n") +
             blue("     しーＪ");


console.log("\n" + face.join("\n"));
console.log("\n" + bold(cyan("          ドラえもん")) + "  " + blue("DORAEMON") + "\n");

// Also show the classic cute version
console.log(cute + "\n");
