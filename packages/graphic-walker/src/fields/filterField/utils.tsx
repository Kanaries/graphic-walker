import { observer } from 'mobx-react-lite';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';
import type { IFilterField, IFilterRule, IRow, DataSet, IFieldStats, IField, IViewField, IFieldReadStats, FilterSortConfig } from '../../interfaces';
import { useGlobalStore } from '../../store';
import LoadingLayer from '../../components/loadingLayer';
import { useComputationFunc, useRenderer } from '../../renderer/hooks';
import { fieldRangeStatsServer, fieldReadRawServer, fieldStatServer, fieldTotalServer } from '../../computation/serverComputation';
import Slider from './slider';
import {
    ChevronDownIcon,
    ChevronUpIcon,
} from '@heroicons/react/24/outline';
import Pagination from '../../components/dataTable/pagination';
import FilterPagination from './filterPagination';
import { toJS } from 'mobx';


// first fetch: to get the number of the rows for pagination
export const useFieldTotal = (
  field: IField,
): {total:number,sum:number}|null => {    
  const { fid } = field;
  const [loading, setLoading] = React.useState(true);
  const [res, setRes] = React.useState({total:0,sum:0});
  const computationFunction = useComputationFunc();

  React.useEffect(() => {
      setLoading(true);
      let isCancelled = false;
      fieldTotalServer(computationFunction, fid).then(
          res => {
              console.log('success',res);
              setRes({total:res.total,sum:res.sum});
              setLoading(false);
          }
      ).catch(
          err => console.warn(err)
      )
      return () => {
          isCancelled = true;
      };
  }, [fid, computationFunction]);

  return loading ? null : res;
};

// 只有attributes采用value的时候才需要返回数据
// 排序交给workflow，不用自己生成cmp
export const useFieldReadStats = (
  field: IField,
  sort: FilterSortConfig ,
  pageSize: number,
  pageOffset: number
): IFieldReadStats | null => {    
  const { fid } = field;
  const [loading, setLoading] = React.useState(true);
  const [stats, setStats] = React.useState<IFieldReadStats | null>(null);
  const computationFunction = useComputationFunc();

  React.useEffect(() => {
      setLoading(true);
      fieldReadRawServer(computationFunction, fid, sort, pageSize, pageOffset ).then(stats => {
          setStats(stats);
          setLoading(false);
      }).catch(reason => {
          console.warn(reason);
          setStats(null);
          setLoading(false);
      });
      return () => {
      };
  }, [fid, pageSize, pageOffset,sort]);
  return stats;
};
