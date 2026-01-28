export enum WidgetType {
  WIDGET_1 = 'widget1',
}

export interface BaseWidget {
  type: string
  displayText?: string
}

export interface Widget1 extends BaseWidget {
  type: WidgetType.WIDGET_1
}

export type Widget = Widget1
