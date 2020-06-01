import generateColors, { scrambleColors } from "./generateColors"

describe("generateColors", () => {
  test("generates colors", () => {
    const colors = generateColors("#1e1e1e", 50)
    expect(colors.length).toBe(50)
  })

  test("can generate randomized colors", () => {
    const orderedColors = generateColors("#1e1e1e", 10)
    expect(orderedColors.length).toBe(10)

    const randomColors = scrambleColors(orderedColors)
    expect(randomColors.length).toBe(10)

    expect(orderedColors).toMatchInlineSnapshot(`
      Array [
        "#896ef7",
        "#6ef7a5",
        "#f7c06e",
        "#dc6ef7",
        "#6ef7f7",
        "#dcf76e",
        "#f76ec0",
        "#6ea5f7",
        "#89f76e",
        "#f76e6e",
      ]
    `)

    expect(
      randomColors.map(
        (color) => `${color} - position ${orderedColors.indexOf(color)}`,
      ),
    ).toMatchInlineSnapshot(`
      Array [
        "#6ea5f7 - position 7",
        "#6ef7f7 - position 4",
        "#6ef7a5 - position 1",
        "#89f76e - position 8",
        "#dcf76e - position 5",
        "#f7c06e - position 2",
        "#f76e6e - position 9",
        "#f76ec0 - position 6",
        "#dc6ef7 - position 3",
        "#896ef7 - position 0",
      ]
    `)
  })
})
