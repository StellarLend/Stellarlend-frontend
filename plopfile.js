// plopfile.js
module.exports = function (plop) {
  plop.setGenerator("component", {
    description: "Generate a component",
    prompts: [
      {
        type: "input",  
        name: "name",
        message: "Component name:",
      },
      {
        type: "list",
        name: "type",
        message: "Component type:",
        choices: ["atoms", "molecules", "organisms"],
      },
    ],
    actions: [
      {
        type: "add",
        path: "/components/{{type}}/{{pascalCase name}}.tsx",
        templateFile: "plop-templates/Component.tsx.hbs",
      },
    ],
  });
};
