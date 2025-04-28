// This is the json schema exported from browser-use, change page_id to tab_id
// TODO: don't know why zod can not generate the same schema, need to fix it
export const jsonNavigatorOutputSchema = {
  properties: {
    current_state: {
      description: 'Current state of the agent',
      properties: {
        evaluation_previous_goal: {
          title: 'Evaluation of previous goal',
          type: 'string',
        },
        memory: {
          title: 'Memory',
          type: 'string',
        },
        next_goal: {
          title: 'Next Goal',
          type: 'string',
        },
      },
      required: ['evaluation_previous_goal', 'memory', 'next_goal'],
      title: 'AgentBrain',
      type: 'object',
    },
    action: {
      items: {
        properties: {
          done: {
            properties: {
              text: {
                title: 'Text',
                type: 'string',
              },
              success: {
                title: 'Success',
                type: 'boolean',
              },
            },
            required: ['text', 'success'],
            title: 'DoneAction',
            type: 'object',
            nullable: true,
          },
          search_google: {
            properties: {
              intent: {
                title: 'Intent',
                type: 'string',
                description: 'purpose of this action',
              },
              query: {
                title: 'Query',
                type: 'string',
              },
            },
            required: ['intent', 'query'],
            title: 'SearchGoogleAction',
            type: 'object',
            nullable: true,
          },
          go_to_url: {
            properties: {
              intent: {
                title: 'Intent',
                type: 'string',
                description: 'purpose of this action',
              },
              url: {
                title: 'Url',
                type: 'string',
              },
            },
            required: ['intent', 'url'],
            title: 'GoToUrlAction',
            type: 'object',
            nullable: true,
          },
          go_back: {
            properties: {
              intent: {
                title: 'Intent',
                type: 'string',
                description: 'purpose of this action',
              },
            },
            required: ['intent'],
            title: 'GoBackAction',
            type: 'object',
            nullable: true,
          },
          wait: {
            properties: {
              intent: {
                title: 'Intent',
                type: 'string',
                description: 'purpose of this action',
              },
              seconds: {
                title: 'Seconds',
                type: 'integer',
                default: 3,
              },
            },
            required: ['intent', 'seconds'],
            title: 'WaitAction',
            type: 'object',
            nullable: true,
          },
          click_element: {
            properties: {
              intent: {
                title: 'Intent',
                type: 'string',
                description: 'purpose of this action',
              },
              index: {
                title: 'Index',
                type: 'integer',
              },
              xpath: {
                type: 'string',
                nullable: true,
              },
            },
            required: ['intent', 'index'],
            title: 'ClickElementAction',
            type: 'object',
            nullable: true,
          },
          input_text: {
            properties: {
              intent: {
                title: 'Intent',
                type: 'string',
                description: 'purpose of this action',
              },
              index: {
                title: 'Index',
                type: 'integer',
              },
              text: {
                title: 'Text',
                type: 'string',
              },
              xpath: {
                type: 'string',
                nullable: true,
              },
            },
            required: ['intent', 'index', 'text'],
            title: 'InputTextAction',
            type: 'object',
            nullable: true,
          },
          switch_tab: {
            properties: {
              intent: {
                title: 'Intent',
                type: 'string',
                description: 'purpose of this action',
              },
              tab_id: {
                title: 'Tab Id',
                type: 'integer',
              },
            },
            required: ['intent', 'tab_id'],
            title: 'SwitchTabAction',
            type: 'object',
            nullable: true,
          },
          open_tab: {
            properties: {
              intent: {
                title: 'Intent',
                type: 'string',
                description: 'purpose of this action',
              },
              url: {
                title: 'Url',
                type: 'string',
              },
            },
            required: ['intent', 'url'],
            title: 'OpenTabAction',
            type: 'object',
            nullable: true,
          },
          close_tab: {
            properties: {
              intent: {
                title: 'Intent',
                type: 'string',
                description: 'purpose of this action',
              },
              tab_id: {
                title: 'Tab Id',
                type: 'integer',
              },
            },
            required: ['intent', 'tab_id'],
            title: 'CloseTabAction',
            type: 'object',
            nullable: true,
          },
          cache_content: {
            properties: {
              intent: {
                title: 'Intent',
                type: 'string',
                description: 'purpose of this action',
              },
              content: {
                title: 'Content',
                type: 'string',
              },
            },
            required: ['intent', 'content'],
            title: 'cache_content_parameters',
            type: 'object',
            nullable: true,
          },
          scroll_down: {
            properties: {
              intent: {
                title: 'Intent',
                type: 'string',
                description: 'purpose of this action',
              },
              amount: {
                type: 'integer',
                nullable: true,
              },
            },
            required: ['intent', 'amount'],
            title: 'ScrollAction',
            type: 'object',
            nullable: true,
          },
          scroll_up: {
            properties: {
              intent: {
                title: 'Intent',
                type: 'string',
                description: 'purpose of this action',
              },
              amount: {
                type: 'integer',
                nullable: true,
              },
            },
            required: ['intent', 'amount'],
            title: 'ScrollAction',
            type: 'object',
            nullable: true,
          },
          send_keys: {
            properties: {
              intent: {
                title: 'Intent',
                type: 'string',
                description: 'purpose of this action',
              },
              keys: {
                title: 'Keys',
                type: 'string',
              },
            },
            required: ['intent', 'keys'],
            title: 'SendKeysAction',
            type: 'object',
            nullable: true,
          },
          scroll_to_text: {
            properties: {
              intent: {
                title: 'Intent',
                type: 'string',
                description: 'purpose of this action',
              },
              text: {
                title: 'Text',
                type: 'string',
              },
            },
            required: ['intent', 'text'],
            title: 'scroll_to_text_parameters',
            type: 'object',
            nullable: true,
          },
          get_dropdown_options: {
            properties: {
              intent: {
                title: 'Intent',
                type: 'string',
                description: 'purpose of this action',
              },
              index: {
                title: 'Index',
                type: 'integer',
              },
            },
            required: ['intent', 'index'],
            title: 'get_dropdown_options_parameters',
            type: 'object',
            nullable: true,
          },
          select_dropdown_option: {
            properties: {
              intent: {
                title: 'Intent',
                type: 'string',
                description: 'purpose of this action',
              },
              index: {
                title: 'Index',
                type: 'integer',
              },
              text: {
                title: 'Text',
                type: 'string',
              },
            },
            required: ['intent', 'index', 'text'],
            title: 'select_dropdown_option_parameters',
            type: 'object',
            nullable: true,
          },
        },
        title: 'ActionModel',
        type: 'object',
      },
      title: 'Action',
      type: 'array',
    },
  },
  required: ['current_state', 'action'],
  title: 'AgentOutput',
  type: 'object',
};
