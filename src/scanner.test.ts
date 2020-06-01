import * as path from "path"
import * as fs from "fs"
import { scan, Scope } from "./scanner"
import { promisify } from "util"

const readFile = promisify(fs.readFile)

function readableScope(scope: Scope) {
  return {
    from: scope.loc.start.line,
    to: scope.loc.end.line,
    bindings: scope.bindings.map((binding) => {
      return {
        [binding.name]: binding.locations.map((l) => [
          `${l.start.line}:${l.start.column}`,
          `${l.end.line}:${l.end.column}`,
        ]),
      }
    }),
  }
}

describe("scanner", () => {
  async function scanFile(filename: string) {
    const code = String(await readFile(filename))
    return scan(filename, code)
  }

  test("can scan TS files in a project without a .babelrc", async () => {
    const filename = path.join(__dirname, "scanner.ts")

    await expect(scanFile(filename)).resolves.toBeDefined()
  })

  test("can find ObjectMethod scopes", async () => {
    const filename = path.join(__dirname, "test.js")
    const code = `
      const foo = {
        enter: () => {
          const findMe = null
          return findMe
        },
      }
    `

    const scopes = scan(filename, code)

    expect(scopes.map(readableScope)).toMatchInlineSnapshot(`
      Array [
        Object {
          "bindings": Array [
            Object {
              "foo": Array [
                Array [
                  "2:12",
                  "2:15",
                ],
              ],
            },
          ],
          "from": 1,
          "to": 8,
        },
        Object {
          "bindings": Array [
            Object {
              "findMe": Array [
                Array [
                  "4:16",
                  "4:22",
                ],
                Array [
                  "5:17",
                  "5:23",
                ],
              ],
            },
          ],
          "from": 3,
          "to": 6,
        },
      ]
    `)
  })
})
