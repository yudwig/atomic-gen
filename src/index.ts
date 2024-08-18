#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import { parse } from "yaml";
import { fileURLToPath } from "url";
import pc from "picocolors";
import Mustache from "mustache";
import * as readline from "node:readline";

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const DEFAULT_BASE_DIR = "src/components";
const DEFAULT_COMPONENT_TMPL_PATH = path.join(
  PACKAGE_ROOT,
  "templates/component.tsx.mustache",
);
const DEFAULT_STORY_TMPL_PATH = path.join(
  PACKAGE_ROOT,
  "templates/component.stories.ts.mustache",
);

interface Command {
  execute(): void;
}

class OptionList {
  private optionMap: Map<string, string>;

  constructor(options: string[]) {
    this.optionMap = this.parseOptions(options);
  }

  private parseOptions(options: string[]): Map<string, string> {
    const map = new Map();
    options.forEach((option) => {
      const [key, value] = option.split("=");
      if (key.startsWith("--") && key.length > 2) {
        map.set(key.slice(2), value);
      }
    });
    return map;
  }

  get(key: string): string | undefined {
    return this.optionMap.get(key);
  }

  hasKey(key: string): boolean {
    return this.optionMap.has(key);
  }
}

class Config {
  private configMap: Map<string, string[]>;

  constructor(configMap: Map<string, string[]>) {
    this.configMap = configMap;
  }

  static read(configPath: string): Config {
    if (!fs.existsSync(configPath)) {
      return handleError(`Not found configuration file. path: ${configPath}`);
    }
    const config = parse(fs.readFileSync(path.resolve(configPath), "utf8"));
    if (
      typeof config !== "object" ||
      config === null ||
      Array.isArray(config)
    ) {
      return handleError("Invalid configuration: Expected an object.");
    }
    const configMap = new Map<string, string[]>();
    Object.entries(config).forEach(([key, val]) => {
      if (Array.isArray(val)) {
        configMap.set(key, val);
      }
    });
    return new Config(configMap);
  }

  createComponentConfigList(baseDir: string): ComponentConfig[] {
    const componentConfigs: ComponentConfig[] = [];
    this.configMap.forEach((componentNames, category) => {
      componentNames.forEach((componentName) => {
        componentConfigs.push(
          new ComponentConfig(baseDir, category, componentName),
        );
      });
    });
    return componentConfigs;
  }
}

class ComponentConfig {
  readonly baseDir: string;
  readonly category: string;
  readonly componentName: string;

  constructor(baseDir: string, category: string, componentName: string) {
    this.baseDir = baseDir;
    this.category = category;
    this.componentName = componentName;
  }

  componentDir(): string {
    return `${this.baseDir}/${this.componentName}/`;
  }

  componentPath(): string {
    return `${this.baseDir}/${this.componentName}/${this.componentName}.tsx`;
  }

  storyPath(): string {
    return `${this.baseDir}/${this.componentName}/${this.componentName}.stories.tsx`;
  }
}

class YesNoPrompt {
  private reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  ask(question: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.reader.question(`${question} (y/N): `, (answer) => {
        resolve(answer.toLowerCase() === "y");
        this.reader.close();
      });
    });
  }
}

class CommandFactory {
  static createCommand(commandName: string, options: OptionList): Command {
    switch (commandName) {
      case "generate":
        return new GenerateCommand(options);
      case "help":
        return new HelpCommand();
      default:
        handleError(
          `Unknown command: '${commandName}'. Please use a valid command.\n\n` +
            "Available commands are:\n" +
            "  generate  - Create new files based on the provided configuration.\n" +
            "  delete    - Remove files based on the provided configuration.\n",
        );
    }
  }
}

class ComponentFileGenerator {
  readonly componentTemplate: string;
  readonly storyTemplate: string;

  constructor(componentTemplate: string, storyTemplate: string) {
    this.componentTemplate = componentTemplate;
    this.storyTemplate = storyTemplate;
  }

  generate(componentConfig: ComponentConfig) {
    if (!fs.existsSync(componentConfig.componentDir())) {
      fs.mkdirSync(componentConfig.componentDir(), { recursive: true });
    }
    this.createFile(
      componentConfig.componentPath(),
      this.componentTemplate,
      componentConfig,
    );
    this.createFile(
      componentConfig.storyPath(),
      this.storyTemplate,
      componentConfig,
    );
  }

  private createFile(filePath: string, template: string, data: object) {
    const content = Mustache.render(template, data);
    fs.writeFileSync(filePath, content);
  }
}

class GenerateCommand implements Command {
  private options: OptionList;

  constructor(options: OptionList) {
    this.options = options;
  }

  async execute() {
    const configPath = this.options.get("config");
    if (configPath === undefined) {
      return handleError("Input config path. --config={path}");
    }
    const config = Config.read(configPath);
    const baseDir = this.options.get("base-dir") || DEFAULT_BASE_DIR;
    if (!fs.existsSync(baseDir)) {
      console.log(
        pc.yellow(
          `The base directory '${baseDir}' does not exist. Creating the directory...`,
        ),
      );
      fs.mkdirSync(baseDir, { recursive: true });
      console.log(pc.yellow(`Directory '${baseDir}' created successfully.\n`));
    }
    const componentConfigs = config.createComponentConfigList(baseDir);
    const createComponentConfigs: ComponentConfig[] = [];
    const isForce = this.options.hasKey("force");

    componentConfigs.forEach((componentConfig) => {
      const paths = [
        componentConfig.componentPath(),
        componentConfig.storyPath(),
      ];
      paths.forEach((path) => {
        if (fs.existsSync(path)) {
          if (isForce) {
            console.log(pc.magenta("overwrite: ") + path);
            createComponentConfigs.push(componentConfig);
            return;
          }
          console.log(`skip: ${path}`);
          return;
        }
        console.log(pc.green("create: ") + path);
        createComponentConfigs.push(componentConfig);
      });
    });
    if (createComponentConfigs.length === 0) {
      console.log(pc.yellow("No files to create. Exiting the process."));
      return;
    }

    const prompt = new YesNoPrompt();
    const answer = await prompt.ask(
      `This action will create ${createComponentConfigs.length} new files. Do you want to proceed? [y/N]:`,
    );
    if (!answer) {
      console.log(pc.yellow("File creation canceled."));
      return;
    }

    const componentTemplatePath =
      this.options.get("component-template") || DEFAULT_COMPONENT_TMPL_PATH;
    const storyTemplatePath =
      this.options.get("story-template") || DEFAULT_STORY_TMPL_PATH;
    const componentTemplate = fs.readFileSync(componentTemplatePath, "utf8");
    const storyTemplate = fs.readFileSync(storyTemplatePath, "utf8");
    const fileGenerator = new ComponentFileGenerator(
      componentTemplate,
      storyTemplate,
    );
    createComponentConfigs.forEach((componentConfig) => {
      fileGenerator.generate(componentConfig);
    });
    console.log(
      pc.green("All files were created successfully. Exiting the process."),
    );
  }
}

class HelpCommand implements Command {
  execute(): void {
    console.log(
      "Usage: npx atomic-gen <command> [options]\n\n" +
        "Commands:\n" +
        "  generate  - Create new files based on the provided configuration.\n" +
        "              This will generate component and story files based on the structure defined in the configuration file.\n" +
        "  help      - Show help information.\n" +
        "              Displays this help message, listing all available commands and options.\n\n" +
        "Generate command options:\n" +
        "  --config   - Specify the configuration file. The configuration file should define the components to generate.\n" +
        "  --base-dir - Specify the base directory for file generation. Default is 'src/components'.\n" +
        "  --force    - Force overwrite existing files. Use this option to overwrite files even if they already exist.\n",
    );
  }
}

function handleError(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function main(args: string[]) {
  const options = new OptionList(args);
  const commandName = options.hasKey("help")
    ? "help"
    : args.slice(2).find((arg) => {
        if (!arg.startsWith("--")) {
          return arg;
        }
      }) || "generate";
  const command = CommandFactory.createCommand(commandName, options);
  command.execute();
}

export { main };
