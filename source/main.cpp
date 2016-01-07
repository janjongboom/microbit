/* mbed Microcontroller Library
 * Copyright (c) 2006-2015 ARM Limited
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// enable accelerometer \o/
#ifdef MICROBIT_BLE_ACCELEROMETER_SERVICE
#undef MICROBIT_BLE_ACCELEROMETER_SERVICE
#endif
#define MICROBIT_BLE_ACCELEROMETER_SERVICE     1

#include "MicroBit.h"

void app_main()
{
  while (1)
  {
    auto z = uBit.accelerometer.getZ();
	  uBit.display.scroll(z);
	  uBit.sleep(1000);
  }
}
