# atomic-gen

`atomic-gen` is a CLI tool designed to automate the generation of React components and their corresponding Storybook stories. It generates standard files based on the specified component names using customizable templates.

## Features

- **Automated React Component Generation**: Automatically generates component files and Storybook story files based on specified templates.
- **Flexible Configuration**: Easily configure the components to be generated using a YAML file.
- **Customizable Templates**: Tailor the generated files to your project’s needs by customizing the default templates.

## Usage

You can run the `atomic-gen` command using `npx` to generate components based on your configuration file.

### Example Command

```bash
npx atomic-gen --config=sample-config.yaml
```

### generate Command Options

- `--config`  
  Specifies the path to the YAML configuration file.  
  **Example**: `--config=sample-config.yaml`

- `--base-dir`  
  Defines the base directory where the component files will be generated. The default is `src/components`.  
  **Example**: `--base-dir=src/ui-components`

- `--force`  
  Forces the overwrite of existing files. If this option is not specified, existing files will be skipped.  

### Usage Example

#### YAML Configuration File

```yaml
atoms:
  - Button
  - Input
molecules:
  - Form
  - Card
organisms:
  - Header
templates:
  - PageTemplate
```

To generate components based on the above configuration, you would run:

```bash
npx atomic-gen --config=components.yaml --base-dir=src/ui-components
```

This command will generate the specified components in the `src/ui-components` directory.

#### Generated File Tree

After running the command, the following file structure will be created:

```plaintext
src/
└── ui-components/
    ├── Button/
    │   ├── Button.tsx
    │   └── Button.stories.tsx
    ├── Input/
    │   ├── Input.tsx
    │   └── Input.stories.tsx
    ├── Form/
    │   ├── Form.tsx
    │   └── Form.stories.tsx
    ├── Card/
    │   ├── Card.tsx
    │   └── Card.stories.tsx
    ├── Header/
    │   ├── Header.tsx
    │   └── Header.stories.tsx
    └── PageTemplate/
        ├── PageTemplate.tsx
        └── PageTemplate.stories.tsx
```

### Template Customization

`atomic-gen` supports Mustache-formatted template files. By default, the following templates are applied:

#### Default Templates

- `component.tsx.mustache`

  ```mustache
  import React from 'react';

  export const {{componentName}} = () => {
    return (
      <div>{{componentName}}</div>
    );
  };
  ```

- `component.stories.ts.mustache`

  ```mustache
  import type { Meta, StoryObj } from '@storybook/react';
  import { {{componentName}} } from './{{componentName}}';

  const meta = {
    title: '{{componentName}}',
    component: {{componentName}},
    parameters: {
      layout: 'centered',
    },
    tags: ['autodocs'],
  } satisfies Meta<typeof {{componentName}}>;

  export default meta;
  type Story = StoryObj<typeof meta>;

  export const Default: Story = {};
  ```

These templates can be customized to fit your project’s specific requirements. You can create your own templates and apply them using the `--component-template` and `--story-template` options, allowing you to maintain a consistent code style across your generated components and stories.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.
