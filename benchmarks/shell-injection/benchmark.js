/**
 * Runs benchmarks for the detection of shell injections
 */
const {
  detectShellInjection,
} = require("../../library/dist/vulnerabilities/shell-injection/detectShellInjection");

const MAX_TIME_LIMIT = 0.05; // milliseconds / statement

function main() {
  const avgTime = getAvgBenchmark();
  if (avgTime > MAX_TIME_LIMIT) {
    console.error(
      `Average time it took for detectShellInjection() : ${avgTime}ms, this exceeds the allowed time of ${MAX_TIME_LIMIT}ms!`
    );
    process.exit(1);
  } else {
    console.info(
      `Average time it took for detectShellInjection() : ${avgTime}ms`
    );
  }
}

main();

function runBenchmark(command, userInput) {
  const startTime = performance.now();
  detectShellInjection(command, userInput);
  const endTime = performance.now();

  return endTime - startTime;
}

/**
 * This function calculates the average time in ms / command
 */
function getAvgBenchmark() {
  const commands = getCommands();
  let avgTime = 0;
  for (const [command, userInput] of commands) {
    avgTime += runBenchmark(command, userInput);
  }
  console.log(avgTime);
  avgTime = avgTime / commands.length;

  return avgTime;
}

function getCommands() {
  return [
    ["ls `", "`"],
    ["ls *", "*"],
    ["ls a", "a"],
    ["ls", ""],
    ["ls", " "],
    ["ls", "  "],
    ["ls", "   "],
    ["ls", "$(echo)"],
    [`ls $(echo)`, "$(echo)"],
    [`ls "$(echo)"`, "$(echo)"],
    [
      `echo $(echo "Inner: $(echo \"This is nested\")")`,
      `$(echo "Inner: $(echo \"This is nested\")")`,
    ],
    [`ls '$(echo)'`, "$(echo)"],
    [
      `ls '$(echo \"Inner: $(echo \"This is nested\")\")'`,
      `$(echo "Inner: $(echo \"This is nested\")")`,
    ],
    ["echo `echo`", "`echo`"],
    [`ls '$(echo)`, "$(echo)"],
    [`ls ''single quote''`, "'single quote'"],
    ["binary --domain www.example`whoami`.com", "www.example`whoami`.com"],
    [`ls "whatever$"`, "whatever$"],
    [`ls "whatever!"`, "whatever!"],
    [`ls "whatever\`"`, "whatever`"],
    ["ls whatever;", "whatever;"],
    ["ls; rm -rf", "; rm -rf"],
    ["rm -rf", "rm -rf"],
    ["ls && rm -rf /", "&& rm -rf /"],
    ["ls || echo 'malicious code'", "|| echo 'malicious code'"],
    ["ls > /dev/null", "> /dev/null"],
    ["cat file.txt > /etc/passwd", "> /etc/passwd"],
    ["echo 'data' >> /etc/passwd", ">> /etc/passwd"],
    ["cat file.txt | grep 'password'", "| grep 'password'"],
    ["echo '|'", "|"],
    [`echo $(cat $(ls))`, `$(cat $(ls))`],
    ["echo 'safe command'", "safe command"],
    ["echo $USER", "$USER"],
    ["echo ${USER}", "${USER}"],
    ['echo "${USER}"', "${USER}"],
    [`ls "$(echo \`whoami\`)"`, "`whoami`"],
    ["echo 'safe'\necho 'malicious'", "\necho 'malicious'"],
    ['echo "safe"; echo "malicious"', '"; echo "malicious"'],
    ["ls -l", " "],
    ["ls   -l", "   "],
    ["  ls -l", "  "],
    ["ls -l ", " "],
    ["echo ' ' ", " "],
    ["command 'arg with spaces'", " "],
    ["command arg1 'arg with spaces' arg2", " "],
    ["command 'arg1'arg2'arg3'", " "],
    ["command", " "],
    ["ENV_VAR='value' command", " "],
    ["ls \nrm", "\nrm"],
    ["ls \nrm -rf", "\nrm -rf"],
    ["ls\n\n", "\n\n"],
    ["/bin/rm -rf", "/bin/rm -rf"],
    ["rm -rf", "rm -rf"],
    ["rm -rf /", "rm -rf /"],
    ["sleep 10", "sleep 10"],
    ["sleep 10 &", "sleep 10 &"],
    ["shutdown -h now", "shutdown -h now"],
    ["halt", "halt"],
    ["poweroff", "poweroff"],
    ["reboot", "reboot"],
    ["reboot -f", "reboot -f"],
    ["ifconfig", "ifconfig"],
    ["ifconfig -a", "ifconfig -a"],
    ["kill", "kill"],
    ["killall", "killall"],
    ["killall -9", "killall -9"],
    ["chmod", "chmod"],
    ["chmod 777", "chmod 777"],
    ["chown", "chown"],
    ["chown root", "chown root"],
    [`find /path/to/search -type f -name "pattern" | xargs rm`, "rm"],
    [`find /path/to/search -type f -name "pattern" -exec rm {} \\;`, "rm"],
    ["ls .|rm", "rm"],
    ["binary sleepwithme", "sleepwithme"],
    ["binary rm-rf", "rm-rf"],
    ["term", "term"],
    ["rm /files/rm.txt", "rm.txt"],
    ["binary --domain www.example.com", "www.example.com"],
    ["binary --domain www.example`whoami`.com", "www.example`whoami`.com"],
  ];
}
