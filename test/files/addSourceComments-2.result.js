"use strict";

var obj = {                                             // Line:  1     | var obj = {
  toString: function toString(value) {                  // Line:  2     |   toString: function (value) {
    return "<div>\n  <h1>" + value + "</h1>\n</div>";   // Lines: 3,4,5 |     return (`<div>  <h1>${value}</h1></div>`);
  }                                                     // Line:  6     |   }
};                                                      // Line:  7     | };
