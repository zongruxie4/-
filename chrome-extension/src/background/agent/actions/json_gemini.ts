// TODO: don't know why zod can not generate the same schema, need to fix it
export const geminiNavigatorOutputSchema = {
  type: 'object',
  properties: {
    current_state: {
      type: 'object',
      description: 'Current state of the agent',
      properties: {
        evaluation_previous_goal: {
          type: 'string',
        },
        memory: {
          type: 'string',
        },
        next_goal: {
          type: 'string',
        },
      },
      required: ['evaluation_previous_goal', 'memory', 'next_goal'],
    },
    action: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          done: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
              },
              success: {
                type: 'boolean',
              },
            },
            required: ['text', 'success'],
            nullable: true,
          },
          search_google: {
            type: 'object',
            properties: {
              intent: {
                type: 'string',
                description: 'purpose of this action',
              },
              query: {
                type: 'string',
              },
            },
            required: ['intent', 'query'],
            nullable: true,
          },
          go_to_url: {
            type: 'object',
            properties: {
              intent: {
                type: 'string',
                description: 'purpose of this action',
              },
              url: {
                type: 'string',
              },
            },
            required: ['intent', 'url'],
            nullable: true,
          },
          go_back: {
            type: 'object',
            properties: {
              intent: {
                type: 'string',
                description: 'purpose of this action',
              },
            },
            required: ['intent'],
            nullable: true,
          },
          wait: {
            type: 'object',
            properties: {
              intent: {
                type: 'string',
                description: 'purpose of this action',
              },
              seconds: {
                type: 'integer',
              },
            },
            required: ['intent', 'seconds'],
            nullable: true,
          },
          click_element: {
            type: 'object',
            properties: {
              intent: {
                type: 'string',
                description: 'purpose of this action',
              },
              index: {
                type: 'integer',
              },
              xpath: {
                type: 'string',
                nullable: true,
              },
            },
            required: ['intent', 'index'],
            nullable: true,
          },
          input_text: {
            type: 'object',
            properties: {
              intent: {
                type: 'string',
                description: 'purpose of this action',
              },
              index: {
                type: 'integer',
              },
              text: {
                type: 'string',
              },
              xpath: {
                type: 'string',
                nullable: true,
              },
            },
            required: ['intent', 'index', 'text'],
            nullable: true,
          },
          switch_tab: {
            type: 'object',
            properties: {
              intent: {
                type: 'string',
                description: 'purpose of this action',
              },
              tab_id: {
                type: 'integer',
              },
            },
            required: ['intent', 'tab_id'],
            nullable: true,
          },
          open_tab: {
            type: 'object',
            properties: {
              intent: {
                type: 'string',
                description: 'purpose of this action',
              },
              url: {
                type: 'string',
              },
            },
            required: ['intent', 'url'],
            nullable: true,
          },
          close_tab: {
            type: 'object',
            properties: {
              intent: {
                type: 'string',
                description: 'purpose of this action',
              },
              tab_id: {
                type: 'integer',
              },
            },
            required: ['intent', 'tab_id'],
            nullable: true,
          },
          cache_content: {
            type: 'object',
            properties: {
              intent: {
                type: 'string',
                description: 'purpose of this action',
              },
              content: {
                type: 'string',
              },
            },
            required: ['intent', 'content'],
            nullable: true,
          },
          scroll_down: {
            type: 'object',
            properties: {
              intent: {
                type: 'string',
                description: 'purpose of this action',
              },
              amount: {
                type: 'integer',
                nullable: true,
              },
            },
            required: ['intent', 'amount'],
            nullable: true,
          },
          scroll_up: {
            type: 'object',
            properties: {
              intent: {
                type: 'string',
                description: 'purpose of this action',
              },
              amount: {
                type: 'integer',
                nullable: true,
              },
            },
            required: ['intent', 'amount'],
            nullable: true,
          },
          send_keys: {
            type: 'object',
            properties: {
              intent: {
                type: 'string',
                description: 'purpose of this action',
              },
              keys: {
                type: 'string',
              },
            },
            required: ['intent', 'keys'],
            nullable: true,
          },
          scroll_to_text: {
            type: 'object',
            properties: {
              intent: {
                type: 'string',
                description: 'purpose of this action',
              },
              text: {
                type: 'string',
              },
            },
            required: ['intent', 'text'],
            nullable: true,
          },
          get_dropdown_options: {
            type: 'object',
            properties: {
              intent: {
                type: 'string',
                description: 'purpose of this action',
              },
              index: {
                type: 'integer',
              },
            },
            required: ['intent', 'index'],
            nullable: true,
          },
          select_dropdown_option: {
            type: 'object',
            properties: {
              intent: {
                type: 'string',
                description: 'purpose of this action',
              },
              index: {
                type: 'integer',
              },
              text: {
                type: 'string',
              },
            },
            required: ['intent', 'index', 'text'],
            nullable: true,
          },
        },
        required: [],
      },
    },
  },
  required: ['current_state', 'action'],
};
