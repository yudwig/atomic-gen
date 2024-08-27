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
    ├── atoms/
    │   ├── Button/
    │   │   ├── Button.tsx
    │   │   └── Button.stories.tsx
    │   └── Input/
    │       ├── Input.tsx
    │       └── Input.stories.tsx
    ├── molecules/
    │   ├── Form/
    │   │   ├── Form.tsx
    │   │   └── Form.stories.tsx
    │   └── Card/
    │       ├── Card.tsx
    │       └── Card.stories.tsx
    ├── organisms/
    │   └── Header/
    │       ├── Header.tsx
    │       └── Header.stories.tsx
    └── templates/
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

### Available Template Variables

When generating components using `atomic-gen`, the following variables are passed to the templates and can be used within them:

- `componentName`: The name of the component (e.g., `Button`, `Form`).
- `categoryName`: The category under which the component is grouped (e.g., `atoms`, `molecules`).
- `componentDir`: The directory path where the component files will be generated.
- `componentPath`: The full path to the generated component file (e.g., `src/components/Button/Button.tsx`).
- `storyPath`: The full path to the generated Storybook story file (e.g., `src/components/Button/Button.stories.tsx`).
- `meta`: An object containing any metadata defined for the component in the YAML configuration file.

### Using Metadata in Templates

In addition to the basic usage, `atomic-gen` now supports the inclusion of metadata for each component. This metadata can be utilized in your templates, allowing for greater flexibility and customization in the generated files.

### Configuration Example with Metadata

You can define metadata for your components in the configuration YAML file as shown below:

```yaml
atoms:
  - Button:
      - color: "blue"
      - size: "large"
  - Input

molecules:
  - Form:
      - method: "POST"
      - action: "/submit"
  - Card
```

In this configuration:

*   The `Button` component has two metadata entries: `color` with the value `blue` and `size` with the value `large`.
*   The `Input` component has no metadata.
*   The `Form` component has two metadata entries: `method` with the value `POST` and `action` with the value `/submit`.
*   The `Card` component has no metadata.

### Accessing Metadata in Templates

Within your Mustache templates, you can access the metadata using the `meta` key. For example, if you are generating a React component, your template might look like this:

```mustache
import React from 'react'; 
export const {{componentName}} = () => { 
  return ( 
    <div className="{{meta.color}} {{meta.size}}"> 
      {{componentName}} component. 
    </div> 
  ); 
};
```

If you use the configuration file example above, the generated component file for `Button` will include the following content:

```javascript
import React from 'react'; 
export const Button = () => { 
  return ( 
    <div className="blue large"> 
      Button component. 
    </div> 
  ); 
};
```

### Notes on Metadata

*   If a component does not have any metadata, the `meta` key will be an empty object, and attempting to reference a non-existent metadata entry in the template will result in an empty string.
*   You can use as many metadata fields as you need, and they can be referenced in any part of your template.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.
