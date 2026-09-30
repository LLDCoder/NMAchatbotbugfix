import type { Moment } from "moment";
import type { BroadcastChannelValues } from "./ChannelsContent";

export interface BroadcastFormValues {
  portal?: string;
  userTypes?: string[];
  publishType?: string;
  expiryTime?: Moment;
  displayPeriod?: [Moment, Moment];
}

export interface BroadcastEditDetailState {
  portal: string;
  publishTimeType: string;
  loadedRecipientsAreAll: boolean;
  formValues: BroadcastFormValues;
  channels: BroadcastChannelValues;
}
