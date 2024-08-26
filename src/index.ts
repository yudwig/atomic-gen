import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';
import { fileURLToPath } from 'url';
import pc from 'picocolors';
import Mustache from 'mustache';
import * as readline from 'node:readline';

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const DEFAULT_BASE_DIR = 'src/components';
const DEFAULT_COMPONENT_TMPL_PATH = path.join(
  PACKAGE_ROOT,
  'templates/component.tsx.mustache',
);
const DEFAULT_STORY_TMPL_PATH = path.join(
  PACKAGE_ROOT,
  'templates/component.stories.ts.mustache',
);

interface Command {
  execute(): Promise<void>;
}

type RawMetadata = {
  [key: string]: string;
}

type RawConfigWithMetadata = {
  [key: string]: RawMetadata[];
}

class CommandLineOptions {
  private optionMap: Map<string, string>;

  constructor(args: string[]) {
    this.optionMap = this.parseArgs(args);
  }

  private parseArgs(args: string[]): Map<string, string> {
    const map = new Map<string, string>();
    args.forEach((option) => {
      const [key, value] = option.split('=');
      if (key.startsWith('--') && key.length > 2) {
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

class Component {
  componentDir: string;
  componentPath: string;
  storyPath: string;
  meta: Map<string, string>

  constructor(
    readonly baseDir: string,
    readonly categoryName: string,
    readonly componentName: string,
    meta: Map<string, string> = new Map<string, string>
  ) {
    this.componentDir = `${this.baseDir}/${this.componentName}/`;
    this.componentPath = `${this.baseDir}/${this.componentName}/${this.componentName}.tsx`;
    this.storyPath = `${this.baseDir}/${this.componentName}/${this.componentName}.stories.tsx`;
    this.meta = meta;
  }
}

class ComponentFileGenerator {
  constructor(
    readonly componentTemplate: string,
    readonly storyTemplate: string,
  ) {}

  generate(component: Component) {
    if (!fs.existsSync(component.componentDir)) {
      fs.mkdirSync(component.componentDir, { recursive: true });
    }
    this.createFile(
      component.componentPath,
      this.componentTemplate,
      component,
    );
    this.createFile(component.storyPath, this.storyTemplate, component);
  }

  private createFile(filePath: string, template: string, data: object) {
    let content = Mustache.render(template, data);
    if (content === undefined) {
      handleError(`Failed to render template for file: ${filePath}`);
    }
    content = content.trim() + '\n';
    fs.writeFileSync(filePath, content);
  }
}

class GenerateCommand implements Command {
  private options: CommandLineOptions;

  constructor(options: CommandLineOptions) {
    this.options = options;
  }

  async execute() {
    const configPath = this.options.get('config');
    if (configPath === undefined) {
      handleError('Input config path. --config={path}');
    }
    const baseDir = this.options.get('base-dir') || DEFAULT_BASE_DIR;
    const components = loadConfigFromFile(configPath, baseDir);
    const newComponents: Component[] = [];
    const isForce = this.options.hasKey('force');

    components.forEach((component) => {
      const paths = [component.componentPath, component.storyPath];
      paths.forEach((path) => {
        if (fs.existsSync(path)) {
          if (isForce) {
            console.log(pc.magenta('overwrite: ') + path);
            newComponents.push(component);
            return;
          }
          console.log(`skip: ${path}`);
          return;
        }
        console.log(pc.green('create: ') + path);
        newComponents.push(component);
      });
    });
    if (newComponents.length === 0) {
      console.log(
        pc.yellow(
          'No files to create. Exiting the process.\nTo overwrite existing files, use the --force option.',
        ),
      );
      return;
    }

    const isYes = await askYesNo(
      `This action will create ${newComponents.length} new files. Do you want to proceed? [y/N]:`,
    );
    if (!isYes) {
      console.log(pc.yellow('File creation canceled.'));
      return;
    }

    if (!fs.existsSync(baseDir)) {
      console.log(
        pc.yellow(
          `The base directory '${baseDir}' does not exist. Creating the directory...`,
        ),
      );
      fs.mkdirSync(baseDir, { recursive: true });
      console.log(pc.yellow(`Directory '${baseDir}' created successfully.\n`));
    }

    const componentTemplatePath =
      this.options.get('component-template') || DEFAULT_COMPONENT_TMPL_PATH;
    const storyTemplatePath =
      this.options.get('story-template') || DEFAULT_STORY_TMPL_PATH;
    const componentTemplate = fs.readFileSync(componentTemplatePath, 'utf8');
    const storyTemplate = fs.readFileSync(storyTemplatePath, 'utf8');
    const fileGenerator = new ComponentFileGenerator(
      componentTemplate,
      storyTemplate,
    );
    newComponents.forEach((component) => {
      fileGenerator.generate(component);
    });
    console.log(
      pc.green('All files were created successfully. Exiting the process.'),
    );
  }
}

class HelpCommand implements Command {
  async execute() {
    console.log(
      'Usage: npx atomic-gen <command> [options]\n\n' +
        'Commands:\n' +
        '  generate (default) - Create new files based on the provided configuration.\n' +
        '                       This will generate component and story files based on the structure \n' +
        '                       defined in the configuration file.\n' +
        '                       If no command is specified, the generate command will be executed by default.\n' +
        '  help               - Show help information.\n' +
        '                       Displays this help message, listing all available commands and options.\n\n' +
        'Generate command options:\n' +
        '  --config   - Specify the configuration file. The configuration file should define ' +
        '               the components to generate.\n' +
        "  --base-dir - Specify the base directory for file generation. Default is 'src/components'.\n" +
        '  --force    - Force overwrite existing files. Use this option to overwrite files even if they already exist.\n',
    );
    await Promise.resolve();
  }
}

function loadConfigFromFile(configPath: string, baseDir: string): Component[] {
  if (!fs.existsSync(configPath)) {
    handleError(`Configuration file not found: ${configPath}`);
  }
  const yaml = parse(
    fs.readFileSync(path.resolve(configPath), 'utf8'),
  ) as { [key: string]: (string | RawConfigWithMetadata)[] };
  const rawMetadataListToMap = (list: RawMetadata[]): Map<string, string> => {
    const map = new Map<string, string>();
    list.forEach((metadata) => {
      Object.entries(metadata).forEach(([key, val]) => {
        map.set(key, val);
      });
    });
    return map;
  };
  const components: Component[] = [];
  Object.entries(yaml).forEach(([categoryName, values]) => {
    values.forEach((val) => {
      if (typeof val === 'string') {
        components.push(new Component(baseDir, categoryName, val));
      }
      if (typeof val === 'object') {
        Object.entries(val).forEach(([componentName, metadataList]) => {
          const metadataMap = rawMetadataListToMap(metadataList as RawMetadata[]);
          components.push(
            new Component(baseDir, categoryName, componentName, metadataMap),
          );
        });
      }
    });
  });
  return components;
}

function handleError(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function askYesNo(question: string): Promise<boolean> {
  const reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    reader.question(`${question} (y/N): `, (answer) => {
      reader.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

function createCommand(
  commandName: string,
  options: CommandLineOptions,
): Command {
  switch (commandName) {
    case 'generate':
      return new GenerateCommand(options);
    case 'help':
      return new HelpCommand();
    default:
      handleError(
        `Unknown command: '${commandName}'. Use 'help' for available commands.`,
      );
  }
}

async function main(args: string[]) {
  const options = new CommandLineOptions(args);
  const commandName = options.hasKey('help')
    ? 'help'
    : args.slice(2).find((arg) => {
        if (!arg.startsWith('--')) {
          return arg;
        }
      }) || 'generate';
  const command = createCommand(commandName, options);
  await command.execute();
}

export { main };
