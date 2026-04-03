'use widget';

import React from 'react';
import { createWidget } from 'expo-widgets';
import { VStack, HStack, Text, ZStack, Circle, Spacer } from '@expo/ui/swift-ui';

type BinNightWidgetProps = {
  showWidget: boolean;
  binTypes: string; // comma-separated: "fogo,rubbish,glass"
  collectionDay: string; // "Tomorrow" or "Today"
  binsAreOut: boolean;
};

const BIN_DISPLAY: Record<string, { label: string; color: string }> = {
  fogo: { label: 'Organics', color: '#8BC34A' },
  rubbish: { label: 'General', color: '#E53935' },
  recycling: { label: 'Recycling', color: '#F2C94C' },
  glass: { label: 'Glass', color: '#9C27B0' },
};

const BinNightWidgetComponent = (
  props: BinNightWidgetProps,
  environment: any
) => {
  // Don't show content if bins are out or no collection
  if (!props.showWidget || props.binsAreOut) {
    return (
      <VStack spacing={8} alignment="center">
        <Text font="headline" weight="bold" color="#8BC34A">
          Bin Night
        </Text>
        <Text font="caption" color="gray">
          No bins to put out
        </Text>
      </VStack>
    );
  }

  const bins = props.binTypes ? props.binTypes.split(',').filter(Boolean) : [];
  const isSmall = environment.widgetFamily === 'systemSmall';

  if (isSmall) {
    // Small widget — compact view
    return (
      <VStack spacing={6} alignment="center">
        <Text font="caption2" weight="semibold" color="#F2C94C">
          {props.collectionDay}
        </Text>
        <Text font="headline" weight="bold" color="white">
          Bin Night
        </Text>
        <HStack spacing={6}>
          {bins.map((bin) => {
            const info = BIN_DISPLAY[bin];
            if (!info) return null;
            return (
              <Circle
                key={bin}
                fill={info.color}
                frame={{ width: 20, height: 20 }}
              />
            );
          })}
        </HStack>
      </VStack>
    );
  }

  // Medium widget — show bin names and colours
  return (
    <HStack spacing={16}>
      <VStack spacing={4} alignment="leading">
        <Text font="caption2" weight="semibold" color="#F2C94C">
          {props.collectionDay}
        </Text>
        <Text font="title3" weight="bold" color="white">
          Bin Night
        </Text>
        <Text font="caption" color="gray">
          Put your bins out
        </Text>
      </VStack>
      <Spacer />
      <VStack spacing={6} alignment="trailing">
        {bins.map((bin) => {
          const info = BIN_DISPLAY[bin];
          if (!info) return null;
          return (
            <HStack key={bin} spacing={8} alignment="center">
              <Text font="caption" color="white">
                {info.label}
              </Text>
              <Circle
                fill={info.color}
                frame={{ width: 16, height: 16 }}
              />
            </HStack>
          );
        })}
      </VStack>
    </HStack>
  );
};

export const BinNightWidget = createWidget<BinNightWidgetProps>(
  'BinNightWidget',
  BinNightWidgetComponent
);
