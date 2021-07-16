# LibHIDTelephony

"This is not an officially supported Google product"

This library aims to support standard USB call control functions based on the USB HID specification defined by USB.org on top of the WebHID API.

## Installation

Use the package manager npm to install the dependencies.

```bash
npm install
```

> **_NOTE:_** This library isn't published to npm yet

## Usage

### Start A Local Testing Web Application

```bash
npm start
```

You can use the application to verify some simple telephony functionalities of a HID telephony device.

### Pack The Testing App

```bash
npm run pack_app
```

The codes should be compiled into `./dist`, that you can directly copy to the host.

### Pack Only The Library

```bash
npm run pack
```

The codes should be compiled into `./dist` as `libtelephony.js`.


### More

Please refer to the `package.json` for more commands you can run.

## Source Code Headers

Every file containing source code must include copyright and license
information. This includes any JS/CSS files that you might be serving out to
browsers. (This is to help well-intentioned people avoid accidental copying that
doesn't comply with the license.)

Apache header:

    Copyright 2021 Google LLC

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        https://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
