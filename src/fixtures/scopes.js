/* eslint-disable @typescript-eslint/no-unused-vars */
// VSCode scope-aware semanic variables using Babel.
//
// Once a color is assigned, no enclosing scope can use that color unless it
// runs out of colors and has to reset

function color0() {

  // This version picks the next color based on a hash of the variable name
  const [ color3, bbb, ccc, color6, color7 ] = []

  console.log( color3, bbb, ccc, color6, color7 )


  // color2 is hoisted to the top of the scope and assigned first
  function color2() {
    const [ color10, bbb, ccc, ddd, color14 ] = []

    console.log( color10, bbb, ccc, ddd, color14 )

    // also hoisted above descructuring
    function color8() {
      const [ color15, bbb, ccc, ddd, color19 ] = []

      console.log( color15, bbb, ccc, ddd, color19 )
    }

    // also hoisted above descructuring
    function color9() {
      // Because color8 has gone out of scope, all of the colors it used are
      // available again.
      const [ color15, bbb, ccc, ddd, color19 ] = []

      console.log( color15, bbb, ccc, ddd, color19 )
    }

  }

}

export default function color1() {
  const [ color2, bbb, ccc, ddd, color6 ] = {}

  console.log( color2, bbb, ccc, ddd, color6 )
}