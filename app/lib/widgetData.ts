import SharedGroupPreferences from 'react-native-shared-group-preferences';

const APP_GROUP_ID = 'group.com.apanic.binnight';

export async function updateWidgetData(data: {
  showWidget: boolean;
  binTypes: string[];
  collectionDay: string;
  binsAreOut: boolean;
}) {
  try {
    // Save each value individually so the Swift widget can read them
    await SharedGroupPreferences.setItem('showWidget', data.showWidget, APP_GROUP_ID);
    await SharedGroupPreferences.setItem('binTypes', data.binTypes.join(','), APP_GROUP_ID);
    await SharedGroupPreferences.setItem('collectionDay', data.collectionDay, APP_GROUP_ID);
    await SharedGroupPreferences.setItem('binsAreOut', data.binsAreOut, APP_GROUP_ID);
    console.log('Widget data updated');
  } catch (error) {
    console.log('Could not update widget data:', error);
  }
}

export async function clearWidgetData() {
  try {
    await SharedGroupPreferences.setItem('showWidget', false, APP_GROUP_ID);
    await SharedGroupPreferences.setItem('binTypes', '', APP_GROUP_ID);
    await SharedGroupPreferences.setItem('collectionDay', '', APP_GROUP_ID);
    await SharedGroupPreferences.setItem('binsAreOut', false, APP_GROUP_ID);
    console.log('Widget data cleared');
  } catch (error) {
    console.log('Could not clear widget data:', error);
  }
}
