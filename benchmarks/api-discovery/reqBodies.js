module.exports = [
  {
    user: {
      id: 1,
      name: "John Doe",
      email: "john.doe@example.com",
      address: {
        street: "123 Main St",
        city: "New York",
        zip: "10001",
      },
      preferences: ["email_notifications", "sms_alerts"],
      lastIpAddress: "192.168.1.1",
      lastLoginDate: "2024-01-01",
    },
  },
  {
    filters: {
      category: "electronics",
      priceRange: { min: 100, max: 1000 },
      availability: true,
    },
    sort: { by: "price", order: "asc" },
    page: 1,
    perPage: 20,
  },
  {
    feedbackType: "bug_report",
    reportedAt: "2024-01-01T14:00:00.00+00:20",
    description: "The app crashes on login",
    metadata: {
      appVersion: "1.0.0",
      device: "iPhone 12",
      os: "iOS 15.6",
    },
  },
  {
    level1: {
      id: 1,
      name: "Level 1",
      isActive: true,
      array: [
        10,
        "string",
        {
          key: "value",
          subArray: [false, null, 3.14, { innerKey: "innerValue" }],
        },
      ],
      level2: {
        id: 2,
        nestedArray: [
          { name: "item1", number: 42 },
          { name: "item2", isAvailable: false },
          [1, 2, { deepObject: { a: 1, b: 2 } }],
        ],
        level3: {
          id: 3,
          data: [
            { value: 123, nested: ["abc", { deeper: true }] },
            { obj: { key1: "val1", key2: [1, 2, 3] } },
            56.78,
            "randomString",
          ],
          level4: {
            id: 4,
            active: false,
            nestedNumbers: [1, 2, [3, 4], { deepKey: "deepValue" }],
            level5: {
              id: 5,
              status: "active",
              complexArray: [
                [null, true, false],
                { a: "string", b: { nestedAgain: [100, { inner: "value" }] } },
                99,
                [true, false, { innerBoolArray: [true, false, true] }],
              ],
              level6: {
                id: 6,
                mixedTypes: [
                  { foo: "bar", nested: { deeperObj: { deep: "finalDepth" } } },
                  [45, 67, { numberNested: 123 }],
                  ["string1", "string2", { stringsInside: ["deepString"] }],
                ],
                level7: {
                  id: 7,
                  booleanFlag: true,
                  test: {
                    feedbackType: "bug_report",
                    description: "The app crashes on login",
                    metadata: {
                      appVersion: "1.0.0",
                      device: "iPhone 12",
                      os: "iOS 15.6",
                    },
                  },
                  numericList: [1, 2, 3, 4, { inside: "inside7" }],
                  level8: {
                    id: 8,
                    coordinates: [{ x: 1, y: 2 }, [5, 6, { z: 7 }]],
                    level9: {
                      id: 9,
                      listOfItems: [
                        { id: 101, text: "item1" },
                        {
                          id: 102,
                          details: { flag: false, arrayInfo: [1, 2, 3] },
                        },
                        [true, { deepArray: ["nested", { last: "element" }] }],
                      ],
                      level10: {
                        id: 10,
                        finalObject: {
                          a: 1,
                          b: [2, 3, { c: 4 }],
                          deepFinal: {
                            end: "This is the deepest level",
                            arrayEnd: [
                              null,
                              true,
                              false,
                              { finalKey: "finalValue" },
                            ],
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  {
    user: {
      id: 1,
      uuid: "000003e8-2363-21ef-b200-325096b39f47",
      name: "John Doe",
      email: "john.doe@example.com",
      address: {
        street: "123 Main St",
        city: "New York",
        zip: "10001",
      },
      preferences: ["email_notifications", "sms_alerts"],
    },
    product: {
      filters: {
        category: "electronics",
        priceRange: { min: 100, max: 1000 },
        availability: true,
      },
      feedback: {
        feedbackType: "bug_report",
        description: "The app crashes on login",
        metadata: {
          appVersion: "1.0.0",
          device: "iPhone 12",
          os: "iOS 15.6",
        },
      },
      sort: { by: "price", order: "asc" },
      page: 1,
      perPage: 20,
    },
    feedback: {
      feedbackType: "bug_report",
      description:
        "Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse molestie consequat, vel illum dolore eu feugiat nulla facilisis at vero eros et accumsan et iusto odio dignissim qui blandit praesent luptatum zzril delenit augue duis dolore te feugait nulla facilisi. Lorem ipsum dolor sit amet,",
      metadata: {
        appVersion: "1.0.0",
        device: "iPhone 12",
        os: "iOS 15.6",
      },
    },
    array: [
      10,
      "string",
      {
        key: "value",
        subArray: [false, null, 3.14, { innerKey: "innerValue" }],
      },
    ],
  },
  {
    user: {
      id: 5,
      name: "Jane Doe",
      email: "jane.doe@example.com",
      address: {
        street: "123 Main St",
        city: "New York",
        zip: "13245",
        country: "USA",
      },
      preferences: [1, 2, 3],
    },
    feedback: {
      feedbackType: "bug_report",
      description:
        "Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse molestie consequat, vel illum dolore eu feugiat nulla facilisis at vero eros et accumsan et iusto odio dignissim qui blandit praesent luptatum zzril delenit augue duis dolore te feugait nulla facilisi. Lorem ipsum dolor sit amet,",
      metadata: {
        appVersion: "1.0.0",
        device: "Android",
        osVer: 14,
      },
    },
    filters: {
      subobject: {
        key: "value",
        nested: {
          key: "value",
          array: [
            {
              key: "value",
              nested: { key: "value" },
            },
          ],
        },
      },
    },
  },
];
