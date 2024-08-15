#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';
import { styleText } from 'node:util';
import Mustache from 'mustache';
import * as readline from "node:readline";

const DEFAULT_BASE_DIR="src/components"
const DEFAULT_COMPONENT_TMPL_PATH="templates/component.tsx.mustache"
const DEFAULT_STORY_TMPL_PATH="templates/component.stories.ts.mustache"

interface Command {
  execute(): void
}

function main(args: string[]) {
  if (args.length < 3) {
    return handleError("Please enter command name");
  }
  const commandName = args[2];
  const options = new OptionList(args.slice(3));
  const command = CommandFactory.createCommand(commandName, options);
  command.execute();
}

function handleError(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

class YesNoPrompt {

  private reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  ask(question: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.reader.question(`${question} (y/N): `, (answer) => {
        resolve(answer.toLowerCase() === 'y');
        this.reader.close();
      });
    });
  }
}

class OptionList {

  private optionMap: Map<string, string>

  constructor(options: string[]) {
    this.optionMap = this.parseOptions(options);
  }

  private parseOptions(options: string[]): Map<string, string> {
    const map = new Map();
    options.forEach(option => {
      const [key, value] = option.split('=');
      if (key.startsWith('--') && key.length > 2 && value !== undefined) {
        map.set(key.slice(2), value);
      }
    });
    return map;
  }

  get(key: string): string | undefined {
    return this.optionMap.get(key);
  }
}

class Config {

  private configMap: Map<string, string[]>

  constructor(configMap: Map<string, string[]>) {
    this.configMap = configMap;
  }

  static read(configPath: string): Config {
    const config = parse(fs.readFileSync(path.resolve(configPath), 'utf8'));
    if (typeof config !== 'object' || config === null || Array.isArray(config)) {
      handleError("Invalid configuration: Expected an object.")
    }
    const configMap = new Map<string, string[]>();
    Object.entries(config).forEach(([key, val]) => {
      if (Array.isArray(val)) {
        configMap.set(key, val);
      }
    })
    return new Config(configMap);
  }

  createComponentConfigList(baseDir: string): ComponentConfig[] {
    const componentConfigs: ComponentConfig[] = [];
    this.configMap.forEach( (componentNames, category) => {
      componentNames.forEach(componentName => {
        componentConfigs.push(new ComponentConfig(baseDir, category, componentName))
      })
    })
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
    this.componentName = componentName
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

class CommandFactory {
  static createCommand(commandName: string, options: OptionList): Command {
    switch (commandName) {
      case 'generate':
        return new GenerateCommand(options);
      default:
        handleError(
          `Unknown command: '${commandName}'. Please use a valid command.\n\n` +
          'Available commands are:\n' +
          '  generate  - Create new files based on the provided configuration.\n' +
          '  delete    - Remove files based on the provided configuration.\n'
        );
    }
  }
}

class GenerateCommand implements Command {

  private options: OptionList

  constructor(options: OptionList) {
    this.options = options
  }

  async execute() {

    const configPath = this.options.get("config")
    if (configPath === undefined) {
      return handleError("Input config path. --config={path}")
    }
    const config = Config.read(configPath)
    const baseDir = this.options.get('base-dir') || DEFAULT_BASE_DIR;
    if (!fs.existsSync(baseDir)) {
      return handleError("Not exist base directory: 'src/components'. --base-dir={path}")
    }
    const componentConfigs = config.createComponentConfigList(baseDir)
    const createComponentConfigs: ComponentConfig[] = []
    componentConfigs.forEach(componentConfig => {
      const paths = [
        componentConfig.componentPath(),
        componentConfig.storyPath()
      ]
      paths.forEach(path => {
        if (fs.existsSync(path)) {
          console.log("  " + path);
          return;
        }
        console.log(styleText("green", "+ " + path));
        createComponentConfigs.push(componentConfig)
      })
    })
    if (createComponentConfigs.length === 0) {
      console.log("No files to create. Exiting the process.")
      return;
    }

    const prompt = new YesNoPrompt();
    const answer = await prompt.ask("This action will create XX new files. Do you want to proceed? [y/N]:")
    if (!answer) {
      console.log('File creation canceled.');
      return;
    }

    const componentTemplate = fs.readFileSync(DEFAULT_COMPONENT_TMPL_PATH, 'utf8');
    const storyTemplate = fs.readFileSync(DEFAULT_STORY_TMPL_PATH, 'utf8');
    createComponentConfigs.forEach(componentConfig => {
      if (!fs.existsSync(componentConfig.componentDir())) {
        fs.mkdirSync(componentConfig.componentDir(), { recursive: true });
      }
      const componentContent = Mustache.render(componentTemplate, {
        componentName: componentConfig.componentName
      });
      const storyContent = Mustache.render(storyTemplate, {
        componentName: componentConfig.componentName
      });
      fs.writeFileSync(componentConfig.componentPath(), componentContent);
      fs.writeFileSync(componentConfig.storyPath(), storyContent);
    })
    console.log("All files were created successfully. Exiting the process.")
  }
}


export { main }


