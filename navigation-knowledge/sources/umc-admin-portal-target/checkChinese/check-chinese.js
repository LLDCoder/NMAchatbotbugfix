import { readFileSync } from 'fs'
import { execFileSync } from 'child_process'

// Han script covers Chinese characters used in commits and source (CJK Unified Ideographs).
const hanReg = /\p{Script=Han}/u
const gitMaxBuffer = 10 * 1024 * 1024

function runGitCommand(args) {
  return execFileSync('git', args, {
    encoding: 'utf-8',
    maxBuffer: gitMaxBuffer,
  })
}

function getStagedFiles() {
  const output = runGitCommand([
    'diff',
    '--cached',
    '--name-only',
    '--diff-filter=ACMR',
    '-z',
  ])

  return output.split('\0').filter(Boolean)
}

function findChineseInStagedFile(filePath) {
  const diff = runGitCommand([
    'diff',
    '--cached',
    '--no-color',
    '-U0',
    '--',
    filePath,
  ])

  const lines = diff.split('\n').filter(
    (line) => line.startsWith('+') && !line.startsWith('+++')
  )

  return lines.find((line) => hanReg.test(line))
}

function checkStagedDiff() {
  const stagedFiles = getStagedFiles()

  for (const filePath of stagedFiles) {
    const hit = findChineseInStagedFile(filePath)

    if (hit) {
      console.error(
        `❌ Chinese (Han script) detected in staged changes (${filePath}):`,
        hit
      )
      process.exit(1)
    }
  }

  console.log('✅ No Chinese detected in staged changes')
}

function checkCommitMessage(messagePath) {
  const msg = readFileSync(messagePath, 'utf-8')

  if (hanReg.test(msg)) {
    console.error(
      '❌ Chinese (Han script) detected in commit message. Please use English only.'
    )
    process.exit(1)
  }
}

const commitMsgFlagIndex = process.argv.indexOf('--commit-msg')
if (commitMsgFlagIndex !== -1 && process.argv[commitMsgFlagIndex + 1]) {
  checkCommitMessage(process.argv[commitMsgFlagIndex + 1])
} else {
  checkStagedDiff()
}
